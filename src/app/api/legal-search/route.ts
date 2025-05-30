import { NextRequest, NextResponse } from 'next/server';
import { CourtListenerAPI } from '@/lib/integrations/courtlistener';
import { supabaseAdmin } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      query,
      focusMode = 'caselaw',
      jurisdiction,
      dateAfter,
      dateBefore,
      court,
      limit = 10,
      matterId
    } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const courtListener = new CourtListenerAPI();
    let results: any[] = [];
    let sources: any[] = [];

    try {
      switch (focusMode) {
        case 'caselaw':
          // Search for case law using CourtListener
          const caseLawResults = await courtListener.searchOpinions(query, {
            court,
            dateAfter,
            dateBefore,
            order_by: '-cluster__date_filed'
          });

          results = caseLawResults.results?.slice(0, limit) || [];
          
          // Store relevant cases in our database for future reference
          for (const caseData of results) {
            try {
              await supabaseAdmin
                .from('case_citations')
                .upsert({
                  courtlistener_id: caseData.id?.toString(),
                  case_name: caseData.cluster?.case_name || 'Unknown Case',
                  citation: caseData.cluster?.citation_string || '',
                  court: caseData.cluster?.docket?.court || court || '',
                  jurisdiction: jurisdiction || '',
                  decision_date: caseData.cluster?.date_filed,
                  docket_number: caseData.cluster?.docket?.docket_number,
                  full_text: caseData.plain_text || caseData.html || '',
                  summary: caseData.plain_text?.substring(0, 500) || '',
                  key_points: [],
                  metadata: {
                    source: 'courtlistener',
                    cluster_id: caseData.cluster?.id,
                    absolute_url: caseData.absolute_url,
                    download_url: caseData.download_url
                  }
                }, { 
                  onConflict: 'courtlistener_id',
                  ignoreDuplicates: true 
                });
            } catch (dbError) {
              console.error('Error storing case in database:', dbError);
              // Continue processing even if storage fails
            }
          }

          sources = results.map(caseData => {
            // Ensure URL always points to CourtListener website
            let url = caseData.absolute_url;
            if (!url || !url.startsWith('http')) {
              url = `https://www.courtlistener.com/opinion/${caseData.id}/`;
            }
            
            return {
              title: caseData.cluster?.case_name || 'Unknown Case',
              url: url,
              snippet: (caseData.plain_text || caseData.html || '').substring(0, 300) + '...',
              citation: caseData.cluster?.citation_string,
              court: caseData.cluster?.docket?.court,
              date: caseData.cluster?.date_filed,
              type: 'case_law'
            };
          });
          break;

        case 'statutory':
          // For now, return a message about statutory search
          // This would be enhanced with additional legal databases
          results = [{
            message: 'Statutory search functionality coming soon. Consider searching case law for judicial interpretations of statutes.',
            suggestion: `Try searching: "${query} statute interpretation" or "${query} statutory construction"`
          }];
          break;

        case 'matterDocuments':
          if (!matterId) {
            return NextResponse.json(
              { error: 'Matter ID is required for matter document search' },
              { status: 400 }
            );
          }

          // Search within matter documents using vector similarity
          const { data: matterDocs } = await supabaseAdmin
            .from('documents')
            .select(`
              *,
              document_chunks(*)
            `)
            .eq('matter_id', matterId)
            .ilike('extracted_text', `%${query}%`)
            .limit(limit);

          results = matterDocs || [];
          sources = results.map(doc => ({
            title: doc.filename,
            snippet: doc.summary || doc.extracted_text?.substring(0, 300) + '...',
            type: 'matter_document',
            document_type: doc.document_type,
            created_at: doc.created_at
          }));
          break;

        default:
          // Default to case law search
          return NextResponse.json(
            { error: 'Invalid focus mode' },
            { status: 400 }
          );
      }

      // Log the search for analytics (optional)
      if (matterId) {
        try {
          await supabaseAdmin
            .from('research_sessions')
            .insert({
              matter_id: matterId,
              query,
              results: { focusMode, resultCount: results.length, sources },
              notes: `Search performed with focus: ${focusMode}`
            });
        } catch (logError) {
          console.error('Error logging research session:', logError);
          // Don't fail the request if logging fails
        }
      }

      return NextResponse.json({
        query,
        focusMode,
        results,
        sources,
        metadata: {
          totalResults: results.length,
          searchTime: new Date().toISOString(),
          jurisdiction,
          court
        }
      });

    } catch (apiError) {
      console.error('CourtListener API error:', apiError);
      
      // Fallback to stored cases if API fails
      if (focusMode === 'caselaw') {
        const { data: storedCases } = await supabaseAdmin
          .from('case_citations')
          .select('*')
          .or(`case_name.ilike.%${query}%,full_text.ilike.%${query}%`)
          .limit(limit);

        return NextResponse.json({
          query,
          focusMode,
          results: storedCases || [],
          sources: (storedCases || []).map(caseData => {
            // Ensure URL always points to CourtListener website for stored cases
            let url = '';
            if (caseData.courtlistener_id) {
              url = `https://www.courtlistener.com/opinion/${caseData.courtlistener_id}/`;
            }
            
            return {
              title: caseData.case_name,
              url: url,
              citation: caseData.citation,
              court: caseData.court,
              date: caseData.decision_date,
              snippet: caseData.summary || caseData.full_text?.substring(0, 300) + '...',
              type: 'case_law_stored'
            };
          }),
          metadata: {
            totalResults: storedCases?.length || 0,
            searchTime: new Date().toISOString(),
            fallback: true,
            error: 'Live search unavailable, showing stored results'
          }
        });
      }

      throw apiError;
    }

  } catch (error) {
    console.error('Error in legal search:', error);
    return NextResponse.json(
      { 
        error: 'Legal search failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}