export type FeedbackCompanyRef = {
  _id?: string;
  name?: string;
};

export type FeedbackUserRef = {
  _id?: string;
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
};

export type FeedbackItem = {
  _id: string;
  type: string;
  message: string;
  rating?: number | null;
  pagePath?: string;
  status: string;
  adminNotes?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  companyId?: FeedbackCompanyRef | null;
  userId?: FeedbackUserRef | null;
};
