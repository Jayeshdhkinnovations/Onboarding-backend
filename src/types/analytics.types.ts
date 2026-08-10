export interface IStatusCount {
  status: "completed" | "in_progress" | "new";
  count: number;
  percentage: number;
}

export interface IAnalyticsOverviewData {
  formId: string;
  total: number;
  completed: number;
  in_progress: number;
  new: number;
  completionRate: number;
  statusDistribution: IStatusCount[];
  dateRange: {
    from: string | null;
    to: string | null;
    timezone: string;
  };
}

export interface AnalyticsOverviewResponse {
  success: boolean;
  data: IAnalyticsOverviewData;
}

export interface IQuestionSummaryOption {
  label: string;
  count: number;
  percentage: number;
}

export interface IQuestionSummaryText {
  sampleAnswers: string[];
}

export interface IQuestionAnalytics {
  fieldId: string;
  label: string;
  type: string;
  totalAnswered: number;
  responseRate: number;
  summary: {
    options?: IQuestionSummaryOption[];
    text?: IQuestionSummaryText;
  };
}

export interface IAnalyticsQuestionsData {
  formId: string;
  totalResponses: number;
  questions: IQuestionAnalytics[];
  dateRange: {
    from: string | null;
    to: string | null;
    timezone: string;
  };
}

export interface AnalyticsQuestionsResponse {
  success: boolean;
  data: IAnalyticsQuestionsData;
}

export interface ITrendPoint {
  date: string;
  total: number;
  completed: number;
}

export interface IAnalyticsTrendsData {
  formId: string;
  interval: "day" | "week" | "month";
  points: ITrendPoint[];
  dateRange: {
    from: string | null;
    to: string | null;
    timezone: string;
  };
}

export interface AnalyticsTrendsResponse {
  success: boolean;
  data: IAnalyticsTrendsData;
}

export interface IFormAnalyticsItem {
  formId: string;
  title: string;
  status: string;
  totalResponses: number;
  completedResponses: number;
  completionRate: number;
  updatedAt: Date | string;
}

export interface IAnalyticsFormsData {
  totalForms: number;
  publishedForms: number;
  totalResponses: number;
  forms: IFormAnalyticsItem[];
}

export interface AnalyticsFormsResponse {
  success: boolean;
  data: IAnalyticsFormsData;
}
