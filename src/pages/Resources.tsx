import React from 'react';
import { BookOpen, Video, FileText, HelpCircle, Star } from 'lucide-react';

export const Resources: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Coming Soon Banner */}
      <div className="bg-gradient-to-br from-[#EFEFF2] to-[#EFEFF2] border border-[#9CFA45] rounded-xl p-12 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-gradient-to-br from-[#9CFA45] to-[#5AAD2B] rounded-xl flex items-center justify-center mx-auto mb-6">
            <BookOpen className="h-8 w-8 text-[#1F1F1F]" />
          </div>
          
          <h3 className="text-2xl font-bold text-[#1F1F1F] mb-4">
            Resource Library Coming Soon
          </h3>
          
          <p className="text-lg text-[#91999A] mb-8">
            We're building a comprehensive resource library to help you maximize your team assessment results 
            and implement effective ministry strategies.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <div className="bg-white rounded-lg p-6 border border-[#EFEFF2]">
              <div className="flex items-center mb-3">
                <Video className="h-5 w-5 text-[#9CFA45] mr-2" />
                <h4 className="font-semibold text-[#1F1F1F]">Training Videos</h4>
              </div>
              <p className="text-sm text-[#91999A]">
                Step-by-step video guides on interpreting results and building balanced teams
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-[#EFEFF2]">
              <div className="flex items-center mb-3">
                <FileText className="h-5 w-5 text-[#5AAD2B] mr-2" />
                <h4 className="font-semibold text-[#1F1F1F]">Implementation Scripts</h4>
              </div>
              <p className="text-sm text-[#91999A]">
                Ready-to-use conversation scripts for team discussions and leadership meetings
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-[#EFEFF2]">
              <div className="flex items-center mb-3">
                <HelpCircle className="h-5 w-5 text-[#84625C] mr-2" />
                <h4 className="font-semibold text-[#1F1F1F]">FAQ & Support</h4>
              </div>
              <p className="text-sm text-[#91999A]">
                Common questions, troubleshooting guides, and best practices from successful churches
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-[#EFEFF2]">
              <div className="flex items-center mb-3">
                <BookOpen className="h-5 w-5 text-[#84625C] mr-2" />
                <h4 className="font-semibold text-[#1F1F1F]">Ministry Guides</h4>
              </div>
              <p className="text-sm text-[#91999A]">
                Comprehensive guides for different ministry areas and leadership development
              </p>
            </div>
          </div>

          <div className="mt-8 p-4 bg-gradient-to-r from-[#9CFA45] to-[#5AAD2B] rounded-lg">
            <div className="flex items-center justify-center text-[#1F1F1F]">
              <Star className="h-5 w-5 mr-2" />
              <span className="font-medium">Resource library coming soon</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="bg-white border border-[#EFEFF2] rounded-xl p-6">
          <div className="w-12 h-12 bg-[#EFEFF2] rounded-lg flex items-center justify-center mb-4">
            <Video className="h-6 w-6 text-[#9CFA45]" />
          </div>
          <h3 className="font-semibold text-[#1F1F1F] mb-2 min-h-[1.5rem]">Video Training Library</h3>
          <p className="text-sm text-[#91999A] mb-4 min-h-[3rem]">
            Professional video content covering assessment interpretation, team building, and leadership development
          </p>
        </div>

        <div className="bg-white border border-[#EFEFF2] rounded-xl p-6">
          <div className="w-12 h-12 bg-[#EFEFF2] rounded-lg flex items-center justify-center mb-4">
            <FileText className="h-6 w-6 text-[#5AAD2B]" />
          </div>
          <h3 className="font-semibold text-[#1F1F1F] mb-2 min-h-[1.5rem]">Implementation Tools</h3>
          <p className="text-sm text-[#91999A] mb-4 min-h-[3rem]">
            Downloadable templates, conversation guides, and action plans for immediate implementation
          </p>
        </div>

        <div className="bg-white border border-[#EFEFF2] rounded-xl p-6">
          <div className="w-12 h-12 bg-[#EFEFF2] rounded-lg flex items-center justify-center mb-4">
            <HelpCircle className="h-6 w-6 text-[#84625C]" />
          </div>
          <h3 className="font-semibold text-[#1F1F1F] mb-2 min-h-[1.5rem]">Expert Support</h3>
          <p className="text-sm text-[#91999A] mb-4 min-h-[3rem]">
            Access to ministry experts, best practices from successful churches, and ongoing support
          </p>
        </div>
      </div>
    </div>
  );
};