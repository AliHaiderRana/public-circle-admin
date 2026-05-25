import mongoose from 'mongoose';

const stepSchema = new mongoose.Schema(
  {
    title: { type: String },
    description: { type: String },
    isCompleted: { type: Boolean, default: false },
    isVisible: { type: Boolean, default: true },
    link: { type: String },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true, unique: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'companies' },
    isSkipped: { type: Boolean, default: false },
    isCompleted: { type: Boolean, default: false },
    steps: [stepSchema],
  },
  { timestamps: true, collection: 'onboarding-progresses' }
);

const OnboardingProgress =
  mongoose.models.OnboardingProgress || mongoose.model('OnboardingProgress', schema);

export default OnboardingProgress;
