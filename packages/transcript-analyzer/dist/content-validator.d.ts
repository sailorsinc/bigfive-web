export interface ContentQualityMetrics {
    wordCount: number;
    sentenceCount: number;
    speakerTurns: number;
    hasQuestions: boolean;
    hasResponses: boolean;
    estimatedQuality: 'poor' | 'fair' | 'good' | 'excellent';
    warnings: string[];
    recommendations: string[];
}
export declare function assessContentQuality(transcript: string): ContentQualityMetrics;
export declare function shouldProceedWithAnalysis(quality: ContentQualityMetrics): {
    proceed: boolean;
    reason?: string;
};
export declare function getQualityScore(quality: ContentQualityMetrics): number;
