'use client';

import { HelpCircle, ArrowLeft, Book, MessageCircle, Settings, FileText, Scale, Briefcase } from 'lucide-react';
import Link from 'next/link';

const HelpSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col space-y-4 p-6 bg-light-secondary/50 dark:bg-dark-secondary/50 rounded-xl border border-light-200 dark:border-dark-200">
    <h2 className="text-black/90 dark:text-white/90 font-semibold text-lg">{title}</h2>
    {children}
  </div>
);

const FeatureCard = ({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) => (
  <div className="flex items-start space-x-3 p-4 bg-light-secondary dark:bg-dark-secondary rounded-lg">
    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
      <Icon size={20} className="text-blue-600 dark:text-blue-400" />
    </div>
    <div>
      <h3 className="text-black/90 dark:text-white/90 font-medium text-sm">{title}</h3>
      <p className="text-black/60 dark:text-white/60 text-sm mt-1">{description}</p>
    </div>
  </div>
);

const Page = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col pt-4">
        <div className="flex items-center space-x-2">
          <Link href="/" className="lg:hidden">
            <ArrowLeft className="text-black/70 dark:text-white/70" />
          </Link>
          <div className="flex flex-row space-x-0.5 items-center">
            <HelpCircle size={23} />
            <h1 className="text-3xl font-medium p-2">Help & Support</h1>
          </div>
        </div>
        <hr className="border-t border-[#2B2C2C] my-4 w-full" />
      </div>

      <div className="flex flex-col space-y-6 pb-28 lg:pb-8">
        <HelpSection title="Getting Started">
          <div className="grid gap-4 md:grid-cols-2">
            <FeatureCard
              icon={Briefcase}
              title="Matter Management"
              description="Create and organize legal matters to keep your cases structured and accessible."
            />
            <FeatureCard
              icon={MessageCircle}
              title="AI Legal Research"
              description="Use natural language to search through case law, statutes, and legal documents."
            />
            <FeatureCard
              icon={FileText}
              title="Document Library"
              description="Upload and manage your legal documents with AI-powered organization."
            />
            <FeatureCard
              icon={Scale}
              title="Case Law Search"
              description="Access comprehensive case law databases with intelligent search capabilities."
            />
          </div>
        </HelpSection>

        <HelpSection title="Key Features">
          <div className="space-y-3">
            <div className="p-4 bg-light-secondary dark:bg-dark-secondary rounded-lg">
              <h3 className="text-black/90 dark:text-white/90 font-medium text-sm mb-2">Legal Research Assistant</h3>
              <p className="text-black/60 dark:text-white/60 text-sm">
                BenchWise provides AI-powered legal research capabilities, allowing you to search through vast legal databases 
                using natural language queries. Get precise answers with proper citations and sources.
              </p>
            </div>
            <div className="p-4 bg-light-secondary dark:bg-dark-secondary rounded-lg">
              <h3 className="text-black/90 dark:text-white/90 font-medium text-sm mb-2">Contract Reviewer</h3>
              <p className="text-black/60 dark:text-white/60 text-sm">
                Upload legal documents for AI analysis, summary generation, and key insight extraction. 
                Perfect for contract review, case preparation, and document discovery.
              </p>
            </div>
            <div className="p-4 bg-light-secondary dark:bg-dark-secondary rounded-lg">
              <h3 className="text-black/90 dark:text-white/90 font-medium text-sm mb-2">Task Automation</h3>
              <p className="text-black/60 dark:text-white/60 text-sm">
                Leverage AI agents to automate routine legal tasks such as brief writing, contract analysis, 
                and discovery processes, saving valuable time for strategic work.
              </p>
            </div>
          </div>
        </HelpSection>

        <HelpSection title="Navigation">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="p-3 bg-light-secondary dark:bg-dark-secondary rounded-lg">
              <h4 className="text-black/90 dark:text-white/90 font-medium text-sm">Research</h4>
              <p className="text-black/60 dark:text-white/60 text-xs mt-1">Start AI-powered legal research conversations</p>
            </div>
            <div className="p-3 bg-light-secondary dark:bg-dark-secondary rounded-lg">
              <h4 className="text-black/90 dark:text-white/90 font-medium text-sm">Matters</h4>
              <p className="text-black/60 dark:text-white/60 text-xs mt-1">Manage your legal cases and matters</p>
            </div>
            <div className="p-3 bg-light-secondary dark:bg-dark-secondary rounded-lg">
              <h4 className="text-black/90 dark:text-white/90 font-medium text-sm">Documents</h4>
              <p className="text-black/60 dark:text-white/60 text-xs mt-1">Upload and organize legal documents</p>
            </div>
            <div className="p-3 bg-light-secondary dark:bg-dark-secondary rounded-lg">
              <h4 className="text-black/90 dark:text-white/90 font-medium text-sm">Case Law</h4>
              <p className="text-black/60 dark:text-white/60 text-xs mt-1">Browse and save important case law</p>
            </div>
            <div className="p-3 bg-light-secondary dark:bg-dark-secondary rounded-lg">
              <h4 className="text-black/90 dark:text-white/90 font-medium text-sm">Tasks</h4>
              <p className="text-black/60 dark:text-white/60 text-xs mt-1">Monitor AI agent task progress</p>
            </div>
            <div className="p-3 bg-light-secondary dark:bg-dark-secondary rounded-lg">
              <h4 className="text-black/90 dark:text-white/90 font-medium text-sm">Settings</h4>
              <p className="text-black/60 dark:text-white/60 text-xs mt-1">Configure AI models and preferences</p>
            </div>
          </div>
        </HelpSection>

        <HelpSection title="Tips & Best Practices">
          <div className="space-y-3">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
              <h4 className="text-blue-800 dark:text-blue-300 font-medium text-sm">Research Tips</h4>
              <p className="text-blue-700 dark:text-blue-200 text-sm mt-1">
                Be specific in your queries. Include jurisdiction, practice area, and relevant facts for better results.
              </p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-500">
              <h4 className="text-green-800 dark:text-green-300 font-medium text-sm">Document Organization</h4>
              <p className="text-green-700 dark:text-green-200 text-sm mt-1">
                Use matters to organize documents by case or client for better workflow management.
              </p>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-l-4 border-yellow-500">
              <h4 className="text-yellow-800 dark:text-yellow-300 font-medium text-sm">AI Model Selection</h4>
              <p className="text-yellow-700 dark:text-yellow-200 text-sm mt-1">
                Configure your preferred AI models in settings for optimal performance based on your needs.
              </p>
            </div>
          </div>
        </HelpSection>

        <HelpSection title="Support">
          <div className="text-center p-6">
            <Book className="mx-auto mb-3 text-black/50 dark:text-white/50" size={32} />
            <h3 className="text-black/90 dark:text-white/90 font-medium mb-2">Need More Help?</h3>
            <p className="text-black/60 dark:text-white/60 text-sm mb-4">
              This is a placeholder help page. For comprehensive documentation and support, 
              please refer to the project documentation or contact your system administrator.
            </p>
            <div className="flex justify-center space-x-4">
              <Link 
                href="/settings" 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Configure Settings
              </Link>
              <Link 
                href="/" 
                className="px-4 py-2 bg-light-secondary dark:bg-dark-secondary text-black dark:text-white rounded-lg hover:bg-light-200 dark:hover:bg-dark-200 transition-colors text-sm"
              >
                Start Research
              </Link>
            </div>
          </div>
        </HelpSection>
      </div>
    </div>
  );
};

export default Page;