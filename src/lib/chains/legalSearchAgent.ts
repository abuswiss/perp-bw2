import { BaseMessage } from '@langchain/core/messages';
import {
  PromptTemplate,
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import {
  RunnableSequence,
  RunnableMap,
  RunnableLambda,
} from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { Document } from '@langchain/core/documents';
import type { StreamEvent } from '@langchain/core/tracers/log_stream';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import { supabaseAdmin } from '../supabase/client';
import { CourtListenerAPI } from '../integrations/courtlistener';

const courtListener = new CourtListenerAPI(process.env.COURTLISTENER_API_KEY!);

const legalQueryPrompt = `
You are a legal research specialist. Given a legal question or issue, generate comprehensive search queries.

Consider:
1. Key legal concepts and doctrines
2. Relevant statutes or regulations  
3. Jurisdictional considerations
4. Procedural vs substantive issues
5. Related causes of action

IMPORTANT: 
- DO NOT wrap the entire query in quotes
- You may use quotes for specific phrases like "death penalty" or "aggravating factors"
- Keep queries focused and relevant
- Avoid overly long queries (max 10-12 keywords)

Current question: {query}

Generate 3-5 specific search queries for case law research, one per line:
`;

const legalSearchRetrieverPrompt = `
You are a legal research assistant analyzing search results. Your goal is to identify the most legally relevant cases and sources.

Consider:
- Jurisdictional hierarchy (binding vs persuasive authority)
- Recency and current validity of cases
- Factual similarity to the current issue
- Strength of legal reasoning
- Subsequent treatment by other courts

Query: {query}
Search results:
{context}

Identify and summarize the most relevant cases, including:
- Case name and citation
- Court and date
- Key holdings
- Relevance to the current query
`;

const legalResponsePrompt = `
You are a senior legal research attorney preparing a comprehensive legal memorandum.

Structure your response as follows:
1. ISSUE PRESENTED: Clear statement of the legal question
2. BRIEF ANSWER: Direct response to the question
3. APPLICABLE LAW: Relevant statutes, regulations, and case law
4. ANALYSIS: Application of law to facts
5. CONCLUSION: Summary and recommendations

Always:
- Use proper legal citations (Bluebook format)
- Distinguish binding from persuasive authority
- Address counter-arguments
- Note any split in authority
- Highlight recent developments

Query: {query}
Context: {context}
Matter Context: {matterContext}

Draft a comprehensive legal analysis:
`;

const processCaseLawResults = (docs: Document[]) => {
  return docs
    .map((doc) => {
      const metadata = doc.metadata;
      const citation = metadata.citation || 'No citation';
      const court = metadata.court || 'Unknown court';
      const date = metadata.date || 'Unknown date';
      
      return `Case: ${metadata.caseName || 'Unknown'}
Citation: ${citation}
Court: ${court}
Date: ${date}
Holding: ${doc.pageContent}
---`;
    })
    .join('\n');
};

const createLegalSearchChain = (llm: BaseChatModel, embeddings: Embeddings) => {
  return RunnableSequence.from([
    RunnableMap.from({
      query: (input: { query: string; matterId?: string; chatHistory?: BaseMessage[] }) => input.query,
      matterId: (input: { query: string; matterId?: string; chatHistory?: BaseMessage[] }) => input.matterId,
      chatHistory: (input: { query: string; matterId?: string; chatHistory?: BaseMessage[] }) => input.chatHistory || [],
    }),
    RunnableMap.from({
      query: (input) => input.query,
      searchQueries: RunnableSequence.from([
        PromptTemplate.fromTemplate(legalQueryPrompt),
        llm,
        new StringOutputParser(),
        (queries: string) => queries.split('\n').filter((q: string) => q.trim()),
      ]),
      matterContext: async (input) => {
        if (!input.matterId) return '';
        
        // Load matter documents
        const { data: documents } = await supabaseAdmin
          .from('documents')
          .select('filename, summary')
          .eq('matter_id', input.matterId)
          .limit(5);
        
        return documents
          ?.map(d => `${d.filename}: ${d.summary}`)
          .join('\n') || '';
      },
    }),
    RunnableMap.from({
      query: (input) => input.query,
      matterContext: (input) => input.matterContext,
      searchResults: async (input) => {
        const allResults: Document[] = [];
        
        // Search CourtListener for each query
        for (let query of input.searchQueries) {
          try {
            // Clean up the query - remove quotes if they wrap the entire query
            query = query.trim();
            if (query.startsWith('"') && query.endsWith('"') && query.length > 2) {
              // Check if there are no other quotes in the middle
              const innerQuery = query.slice(1, -1);
              if (!innerQuery.includes('"')) {
                query = innerQuery;
              }
            }
            
            console.log(`Searching CourtListener for: "${query}"`);
            const searchResult = await courtListener.searchCases(query);
            const cases = searchResult.results || [];
            console.log(`Found ${cases.length} cases (out of ${searchResult.count} total)`);
            
            for (const caseData of cases) {
              allResults.push(
                new Document({
                  pageContent: caseData.text || '',
                  metadata: {
                    caseName: caseData.case_name,
                    citation: caseData.citation.join(', '),
                    court: caseData.court,
                    date: caseData.date_filed,
                    courtListenerId: caseData.id,
                    url: caseData.absolute_url ? `https://www.courtlistener.com${caseData.absolute_url}` : ''
                  },
                })
              );
            }
          } catch (error) {
            console.error('CourtListener search error for query:', query, error);
          }
        }
        
        // Also search in stored cases (simplified for now)
        // TODO: Implement vector search once embeddings are set up
        const { data: storedCases } = await supabaseAdmin
          .from('case_citations')
          .select('*')
          .limit(10);
        
        if (storedCases) {
          for (const caseData of storedCases) {
            allResults.push(
              new Document({
                pageContent: caseData.full_text || caseData.summary || '',
                metadata: {
                  caseName: caseData.case_name,
                  citation: caseData.citation,
                  court: caseData.court,
                  date: caseData.decision_date,
                  similarity: caseData.similarity
                },
              })
            );
          }
        }
        
        return allResults;
      },
    }),
    RunnableMap.from({
      query: (input) => input.query,
      matterContext: (input) => input.matterContext,
      relevantCases: RunnableSequence.from([
        (input) => ({
          query: input.query,
          context: processCaseLawResults(input.searchResults),
        }),
        PromptTemplate.fromTemplate(legalSearchRetrieverPrompt),
        llm,
        new StringOutputParser(),
      ]),
    }),
    RunnableSequence.from([
      (input) => ({
        query: input.query,
        context: input.relevantCases,
        matterContext: input.matterContext,
      }),
      PromptTemplate.fromTemplate(legalResponsePrompt),
      llm,
      new StringOutputParser(),
    ]),
  ]);
};

const handleStream = async (
  stream: AsyncGenerator<StreamEvent>,
  onEvent: (data: any) => void,
) => {
  for await (const event of stream) {
    if (
      event.event === 'on_chain_end' &&
      event.name === 'FinalResponseGenerator'
    ) {
      onEvent({
        type: 'response',
        data: event.data.output,
      });
    }
    
    if (
      event.event === 'on_chain_end' &&
      event.name === 'FinalSourceRetriever'
    ) {
      onEvent({
        type: 'sources',
        data: event.data.output.searchResults.map((doc: Document) => ({
          caseName: doc.metadata.caseName,
          citation: doc.metadata.citation,
          court: doc.metadata.court,
          date: doc.metadata.date,
          url: doc.metadata.url,
          snippet: doc.pageContent.slice(0, 200) + '...',
        })),
      });
    }
  }
};

export const legalSearchAgent = async (
  query: string,
  chatHistory: BaseMessage[],
  llm: BaseChatModel,
  embeddings: Embeddings,
  matterId?: string,
  onEvent?: (data: any) => void,
) => {
  const chain = createLegalSearchChain(llm, embeddings).withConfig({
    runName: 'LegalSearchAgent',
  });

  const stream = chain.streamEvents(
    {
      query,
      chatHistory,
      matterId,
    },
    {
      version: 'v1',
    },
  );

  if (onEvent) {
    await handleStream(stream, onEvent);
  } else {
    return chain.invoke({
      query,
      chatHistory,
      matterId,
    });
  }
};