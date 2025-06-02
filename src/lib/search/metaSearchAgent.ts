import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
} from '@langchain/core/prompts';
import {
  RunnableLambda,
  RunnableMap,
  RunnableSequence,
} from '@langchain/core/runnables';
import { BaseMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import LineListOutputParser from '../outputParsers/listLineOutputParser';
import LineOutputParser from '../outputParsers/lineOutputParser';
import { getDocumentsFromLinks } from '../utils/documents';
import { Document } from 'langchain/document';
import { searchSearxng } from '../searxng';
import { performWebSearch } from './providers';
import path from 'node:path';
import fs from 'node:fs';
import computeSimilarity from '../utils/computeSimilarity';
import formatChatHistoryAsString from '../utils/formatHistory';
import eventEmitter from 'events';
import { StreamEvent } from '@langchain/core/tracers/log_stream';

export interface MetaSearchAgentType {
  searchAndAnswer: (
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
    systemInstructions: string,
  ) => eventEmitter;
}

interface Config {
  searchWeb: boolean;
  rerank: boolean;
  summarizer: boolean;
  rerankThreshold: number;
  queryGeneratorPrompt: string;
  responsePrompt: string;
  activeEngines: string[];
  isMultiQuery?: boolean;
}

type BasicChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

class MetaSearchAgent implements MetaSearchAgentType {
  private config: Config;
  private strParser = new StringOutputParser();
  private lastRetrievedDocs: Document[] = []; // Store documents for source emission

  constructor(config: Config) {
    this.config = config;
    this.config.isMultiQuery = this.config.isMultiQuery || false;
  }

  private extractPageNumber(content: string): number | undefined {
    // Try to extract page number from various formats
    const patterns = [
      /page\s*(\d+)/i,
      /p\.\s*(\d+)/i,
      /(\d+)\s*of\s*\d+/i,
      /^(\d+)\s*\n/,
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }
    
    return undefined;
  }

  private async createSearchRetrieverChain(llm: BaseChatModel) {
    if (llm && 'temperature' in llm) {
      (llm as any).temperature = 0;
    }

    return RunnableSequence.from([
      PromptTemplate.fromTemplate(this.config.queryGeneratorPrompt),
      llm,
      this.strParser,
      RunnableLambda.from(async (llmOutputString: string) => {
        if (this.config.isMultiQuery) {
          const individualQueries = llmOutputString
            .split('\n')
            .map(q => q.trim())
            .filter(q => q.length > 0 && !q.toLowerCase().startsWith("rephrased question:"));

          let allDocs: Document[] = [];
          const processedUrls = new Set<string>();

          console.log('[MetaSearchAgent] Individual queries (isMultiQuery=true):', individualQueries);

          for (const singleQuery of individualQueries) {
            console.log(`[MetaSearchAgent] Executing web search for individual query: "${singleQuery}"`);
            try {
              const res = await performWebSearch(singleQuery, {
                language: 'en',
                engines: this.config.activeEngines,
              });
              console.log(`[MetaSearchAgent] Raw results for query "${singleQuery}":`, JSON.stringify(res.results, null, 2));

              const documents = res.results
                .filter(result => result.url && !processedUrls.has(result.url))
                .map((result) => {
                  processedUrls.add(result.url!);
                  return new Document({
                    pageContent: result.content || (this.config.activeEngines.includes('youtube') ? result.title : ''),
                    metadata: {
                      title: result.title,
                      url: result.url,
                      ...(result.img_src && { img_src: result.img_src }),
                    },
                  });
                });
              allDocs = allDocs.concat(documents);
            } catch (error) {
              console.error(`[MetaSearchAgent] Error searching for query "${singleQuery}":`, error);
            }
          }
          return { query: llmOutputString, docs: allDocs };

        } else {
          const linksOutputParser = new LineListOutputParser({ key: 'links' });
          const questionOutputParser = new LineOutputParser({ key: 'question' });
          let question = llmOutputString;

          let links: string[] = [];
          if (llmOutputString.includes("<links>")) {
            links = await linksOutputParser.parse(llmOutputString);
          }
          if (llmOutputString.includes("<question>")) {
            const questionMatch = llmOutputString.match(/<question>([\s\S]*?)<\/question>/);
            question = questionMatch && questionMatch[1] ? questionMatch[1].trim() : question;
          } else if (links.length > 0 && !this.config.summarizer) {
            let tempQuestion = llmOutputString;
            links.forEach(link => {
               tempQuestion = tempQuestion.replace(link, '');
            });
            tempQuestion = tempQuestion.replace(/<links>|<\/links>/g, '').trim();
            if (tempQuestion) question = tempQuestion;
          }
          
          if (question.toLowerCase().trim() === 'not_needed') {
            return { query: '', docs: [] };
          }

          if (links.length > 0) {
            console.log(`[MetaSearchAgent] Processing links (isMultiQuery=false):`, links);
            console.log(`[MetaSearchAgent] Question associated with links: "${question}"`);
            const linkDocs = await getDocumentsFromLinks({ links });
            return { query: question, docs: linkDocs };
          } else {
            const finalQuery = question.replace(/<think>.*?<\/think>/g, '').replace(/<question>|<\/question>/g, '').trim();
            if (!finalQuery) {
                console.log('[MetaSearchAgent] Final query is empty after stripping tags, returning no docs.');
                return { query: llmOutputString, docs: [] };
            }

            console.log(`[MetaSearchAgent] Executing web search with single query (isMultiQuery=false): "${finalQuery}"`);
            const res = await performWebSearch(finalQuery, {
              language: 'en',
              engines: this.config.activeEngines,
            });
            console.log(`[MetaSearchAgent] Raw results for single query "${finalQuery}":`, JSON.stringify(res.results, null, 2));
            const documents = res.results.map(
              (result) => new Document({
                  pageContent: result.content || (this.config.activeEngines.includes('youtube') ? result.title : ''),
                  metadata: {
                    title: result.title,
                    url: result.url,
                    ...(result.img_src && { img_src: result.img_src }),
                  },
                }),
            );
            return { query: finalQuery, docs: documents };
          }
        }
      }),
    ]);
  }

  private async createAnsweringChain(
    llm: BaseChatModel,
    fileIds: string[],
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    systemInstructions: string,
  ) {
    try {
      return RunnableSequence.from([
      RunnableMap.from({
        systemInstructions: () => systemInstructions,
        query: (input: BasicChainInput) => input.query,
        chat_history: (input: BasicChainInput) => input.chat_history,
        date: () => new Date().toISOString(),
        context: RunnableLambda.from(async (input: BasicChainInput) => {
          const processedHistory = formatChatHistoryAsString(
            input.chat_history,
          );

          let docs: Document[] | null = null;
          let query = input.query;

          if (this.config.searchWeb) {
            const searchRetrieverChain =
              await this.createSearchRetrieverChain(llm);

            const searchRetrieverResult = await searchRetrieverChain.invoke({
              chat_history: processedHistory,
              query,
            });

            query = searchRetrieverResult.query;
            docs = searchRetrieverResult.docs;
          }

          const sortedDocs = await this.rerankDocs(
            query,
            docs ?? [],
            fileIds,
            embeddings,
            optimizationMode,
          );

          // Store documents for source emission
          this.lastRetrievedDocs = sortedDocs;

          return sortedDocs;
        })
          .withConfig({
            runName: 'FinalSourceRetriever',
          })
          .pipe(this.processDocs),
      }),
      PromptTemplate.fromTemplate(`${this.config.responsePrompt}

Chat History: {chat_history}
User Query: {query}
Context: {context}
System Instructions: {systemInstructions}
Date: {date}

Please provide a comprehensive response based on the above information.`),
      llm,
      this.strParser,
    ]).withConfig({
      runName: 'FinalResponseGenerator',
    });
    } catch (error) {
      console.error('❌ Error creating RunnableSequence:', error);
      throw error;
    }
  }

  private async rerankDocs(
    query: string,
    docs: Document[],
    fileIds: string[],
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
  ) {
    if (docs.length === 0 && fileIds.length === 0) {
      return docs;
    }

    const filesData = fileIds
      .map((file) => {
        const filePath = path.join(process.cwd(), 'uploads', file);

        const contentPath = filePath + '-extracted.json';
        const embeddingsPath = filePath + '-embeddings.json';

        const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
        const embeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf8'));

        const fileSimilaritySearchObject = content.contents.map(
          (c: string, i: number) => {
            return {
              fileName: content.title,
              content: c,
              embeddings: embeddings.embeddings[i],
              fileId: file,
              chunkIndex: i,
              // Try to extract page number from content (e.g., "Page 2 of 5")
              pageNumber: this.extractPageNumber(c),
              uploadDate: content.metadata?.uploadDate,
            };
          },
        );

        return fileSimilaritySearchObject;
      })
      .flat();

    if (query.toLocaleLowerCase() === 'summarize') {
      return docs.slice(0, 15);
    }

    const docsWithContent = docs.filter(
      (doc) => doc.pageContent && doc.pageContent.length > 0,
    );

    if (optimizationMode === 'speed' || this.config.rerank === false) {
      if (filesData.length > 0) {
        const [queryEmbedding] = await Promise.all([
          embeddings.embedQuery(query),
        ]);

        const fileDocs = filesData.map((fileData) => {
          return new Document({
            pageContent: fileData.content,
            metadata: {
              title: fileData.fileName,
              url: `file://${fileData.fileId}`,
              documentId: fileData.fileId,
              chunkIndex: fileData.chunkIndex,
              pageNumber: fileData.pageNumber,
              type: 'document',
              date: fileData.uploadDate,
            },
          });
        });

        const similarity = filesData.map((fileData, i) => {
          const sim = computeSimilarity(queryEmbedding, fileData.embeddings);

          return {
            index: i,
            similarity: sim,
          };
        });

        let sortedDocs = similarity
          .filter(
            (sim) => sim.similarity > (this.config.rerankThreshold ?? 0.3),
          )
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 15)
          .map((sim) => fileDocs[sim.index]);

        sortedDocs =
          docsWithContent.length > 0 ? sortedDocs.slice(0, 8) : sortedDocs;

        return [
          ...sortedDocs,
          ...docsWithContent.slice(0, 15 - sortedDocs.length),
        ];
      } else {
        return docsWithContent.slice(0, 15);
      }
    } else if (optimizationMode === 'balanced') {
      const [docEmbeddings, queryEmbedding] = await Promise.all([
        embeddings.embedDocuments(
          docsWithContent.map((doc) => doc.pageContent),
        ),
        embeddings.embedQuery(query),
      ]);

      docsWithContent.push(
        ...filesData.map((fileData) => {
          return new Document({
            pageContent: fileData.content,
            metadata: {
              title: fileData.fileName,
              url: `file://${fileData.fileId}`,
              documentId: fileData.fileId,
              chunkIndex: fileData.chunkIndex,
              pageNumber: fileData.pageNumber,
              type: 'document',
              date: fileData.uploadDate,
            },
          });
        }),
      );

      docEmbeddings.push(...filesData.map((fileData) => fileData.embeddings));

      const similarity = docEmbeddings.map((docEmbedding, i) => {
        const sim = computeSimilarity(queryEmbedding, docEmbedding);

        return {
          index: i,
          similarity: sim,
        };
      });

      const sortedDocs = similarity
        .filter((sim) => sim.similarity > (this.config.rerankThreshold ?? 0.3))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 15)
        .map((sim) => docsWithContent[sim.index]);

      return sortedDocs;
    }

    return [];
  }

  private processDocs(docs: Document[]) {
    return docs
      .map(
        (_, index) =>
          `${index + 1}. ${docs[index].metadata.title} ${docs[index].pageContent}`,
      )
      .join('\n');
  }

  private async handleStream(
    stream: AsyncGenerator<StreamEvent, any, any>,
    emitter: eventEmitter,
  ) {
    for await (const event of stream) {
      if (
        event.event === 'on_chain_end' &&
        event.name === 'FinalSourceRetriever'
      ) {
        console.log('[MetaSearchAgent] Emitting sources:', JSON.stringify(this.lastRetrievedDocs, null, 2));
        emitter.emit(
          'data',
          JSON.stringify({ type: 'sources', data: this.lastRetrievedDocs }),
        );
      }
      if (
        event.event === 'on_chain_stream' &&
        event.name === 'FinalResponseGenerator'
      ) {
        emitter.emit(
          'data',
          JSON.stringify({ type: 'response', data: event.data.chunk }),
        );
      }
      if (
        event.event === 'on_chain_end' &&
        event.name === 'FinalResponseGenerator'
      ) {
        emitter.emit('end');
      }
    }
  }

  searchAndAnswer(
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
    systemInstructions: string,
  ) {
    const emitter = new eventEmitter();

    // Initialize the answering chain and start streaming in the background
    this.createAnsweringChain(
      llm,
      fileIds,
      embeddings,
      optimizationMode,
      systemInstructions,
    ).then(answeringChain => {
      const stream = answeringChain.streamEvents(
        {
          chat_history: history,
          query: message,
        },
        {
          version: 'v1',
        },
      );

      this.handleStream(stream, emitter);
    }).catch(error => {
      console.error('Error creating answering chain:', error);
      emitter.emit('error', error);
    });

    return emitter;
  }
}

export default MetaSearchAgent;
