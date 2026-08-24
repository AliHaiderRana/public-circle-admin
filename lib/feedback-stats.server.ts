import dbConnect from '@/lib/db';
import Feedback from '@/lib/models/Feedback';
import { FEEDBACK_STATUS } from '@/lib/constants';

export async function getNewFeedbackCount(): Promise<number> {
  await dbConnect();
  return Feedback.countDocuments({
    status: FEEDBACK_STATUS.NEW,
  });
}
