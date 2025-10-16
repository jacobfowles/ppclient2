import React from 'react';
import { Lightbulb, Brain, TrendingUp, Users, Target, Star } from 'lucide-react';

export const Insights: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Coming Soon Banner */}
      <div className="bg-gradient-to-br from-[#EFEFF2] to-[#EFEFF2] border border-[#9CFA45] rounded-xl p-12 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-gradient-to-br from-[#9CFA45] to-[#5AAD2B] rounded-xl flex items-center justify-center mx-auto mb-6">
            <Brain className="h-8 w-8 text-[#1F1F1F]" />
          </div>
          
          <h3 className="text-2xl font-bold text-[#1F1F1F] mb-4">
            Advanced AI Insights Coming Soon
          </h3>
          
          <p className="text-lg text-[#91999A] mb-8">
            Our AI engine is being trained to provide intelligent recommendations for optimal team composition, 
            leadership balance, and strategic insights based on your assessment data.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <div className="bg-white rounded-lg p-6 border border-[#EFEFF2]">
              <div className="flex items-center mb-3">
                <Target className="h-5 w-5 text-[#9CFA45] mr-2" />
                <h4 className="font-semibold text-[#1F1F1F]">Team Balance Analysis</h4>
              </div>
              <p className="text-sm text-[#91999A]">
                AI-powered recommendations for achieving optimal quadrant distribution across your teams
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-[#EFEFF2]">
              <div className="flex items-center mb-3">
                <Users className="h-5 w-5 text-[#5AAD2B] mr-2" />
                <h4 className="font-semibold text-[#1F1F1F]">Leadership Optimization</h4>
              </div>
              <p className="text-sm text-[#91999A]">
                Smart suggestions for leadership placement based on profile compatibility and team needs
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-[#EFEFF2]">
              <div className="flex items-center mb-3">
                <TrendingUp className="h-5 w-5 text-[#84625C] mr-2" />
                <h4 className="font-semibold text-[#1F1F1F]">Growth Predictions</h4>
              </div>
              <p className="text-sm text-[#91999A]">
                Predictive analytics to anticipate team growth patterns and capacity planning
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-[#EFEFF2]">
              <div className="flex items-center mb-3">
                <Lightbulb className="h-5 w-5 text-[#84625C] mr-2" />
                <h4 className="font-semibold text-[#1F1F1F]">Strategic Insights</h4>
              </div>
              <p className="text-sm text-[#91999A]">
                Actionable insights for improving ministry effectiveness and team performance
              </p>
            </div>
          </div>

          <div className="mt-8 p-4 bg-gradient-to-r from-[#9CFA45] to-[#5AAD2B] rounded-lg">
            <div className="flex items-center justify-center text-[#1F1F1F]">
              <Star className="h-5 w-5 mr-2" />
              <span className="font-medium">Premium AI features coming soon</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white border border-[#EFEFF2] rounded-xl p-6">
          <div className="w-12 h-12 bg-[#EFEFF2] rounded-lg flex items-center justify-center mb-4">
            <Brain className="h-6 w-6 text-[#9CFA45]" />
          </div>
          <h3 className="font-semibold text-[#1F1F1F] mb-2">Machine Learning Models</h3>
          <p className="text-sm text-[#91999A] mb-4">
            Advanced algorithms trained on ministry team dynamics and proven leadership patterns
          </p>
          <div className="text-xs text-[#91999A] bg-[#EFEFF2] rounded px-3 py-2">
            Advanced machine learning algorithms
          </div>
        </div>

        <div className="bg-white border border-[#EFEFF2] rounded-xl p-6">
          <div className="w-12 h-12 bg-[#EFEFF2] rounded-lg flex items-center justify-center mb-4">
            <TrendingUp className="h-6 w-6 text-[#5AAD2B]" />
          </div>
          <h3 className="font-semibold text-[#1F1F1F] mb-2">Predictive Analytics</h3>
          <p className="text-sm text-[#91999A] mb-4">
            Forecast team performance, identify potential conflicts, and optimize leadership placement
          </p>
          <div className="text-xs text-[#91999A] bg-[#EFEFF2] rounded px-3 py-2">
            Intelligent predictive modeling
          </div>
        </div>

        <div className="bg-white border border-[#EFEFF2] rounded-xl p-6">
          <div className="w-12 h-12 bg-[#EFEFF2] rounded-lg flex items-center justify-center mb-4">
            <Lightbulb className="h-6 w-6 text-[#84625C]" />
          </div>
          <h3 className="font-semibold text-[#1F1F1F] mb-2">Actionable Recommendations</h3>
          <p className="text-sm text-[#91999A] mb-4">
            Specific, implementable suggestions tailored to your church's unique context and goals
          </p>
          <div className="text-xs text-[#91999A] bg-[#EFEFF2] rounded px-3 py-2">
            Personalized for your ministry context
          </div>
        </div>
      </div>
    </div>
  );
};