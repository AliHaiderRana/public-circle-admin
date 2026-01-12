import mongoose from 'mongoose';

const COMPANY_CONTACT_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  DELETED: "DELETED",
};

const UNSUBSCRIBED_BY = {
  USER: "USER",
  SYSTEM: "SYSTEM",
};

const UNSUBSCRIBED_BY_USER_REASON = {
  USER_REQUESTED: "USER_REQUESTED",
  COMPLAINT: "COMPLAINT",
};

const UNSUBSCRIBED_BY_SYSTEM_REASON = {
  BOUNCE: "BOUNCE",
  COMPLAINT: "COMPLAINT",
};

const schema = new mongoose.Schema(
  {
    public_circles_company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: 'companies',
    },
    public_circles_status: {
      type: String,
      required: true,
      enum: Object.values(COMPANY_CONTACT_STATUS),
      default: COMPANY_CONTACT_STATUS.ACTIVE,
    },
    public_circles_existing_contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'company-contact',
    },
    public_circles_is_unsubscribed: {
      type: Boolean,
      default: false,
    },
    public_circles_unsubscribed_by: {
      type: String,
      enum: Object.values(UNSUBSCRIBED_BY),
      default: UNSUBSCRIBED_BY.USER,
    },
    public_circles_unsubscribed_reason: {
      type: String,
      enum: [...Object.values(UNSUBSCRIBED_BY_USER_REASON), ...Object.values(UNSUBSCRIBED_BY_SYSTEM_REASON)],
      default: null,
    },
    public_circles_contact_deletion_reason: {
      type: Object,
      default: {},
    },
    public_circles_suppression_track: {
      eventType: { type: String, default: null },
      bounceType: { type: String, default: null },
      timestamp: { type: Date, default: null },
    },
  },
  {
    timestamps: {
      createdAt: "public_circles_createdAt", // Custom name for createdAt
      updatedAt: "public_circles_updatedAt", // Custom name for updatedAt
    },
    strict: false,
  }
);

const convertStringDatesToDateObjects = (doc: any) => {
  Object.keys(doc).forEach((key) => {
    try {
      if (typeof doc[key] === "string" && 
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(doc[key]) &&
          !isNaN(Date.parse(doc[key]))) {
        doc[key] = new Date(doc[key]);
      }
    } catch (error: any) {
      console.log("error converting date string to Date object", error.message);
    }
  });
};

schema.pre("save", function (next: any) {
  convertStringDatesToDateObjects(this);
  next();
});

schema.pre("insertMany", function (next: any) {
  const docs = (this as any).getDocuments();
  docs.forEach((doc: any) => {
    convertStringDatesToDateObjects(doc);
  });
  next();
});

schema.index({
  public_circles_company: 1,
  public_circles_status: 1,
  public_circles_createdAt: 1,
});

schema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function (next: any) {
  const update = (this as any).getUpdate();
  if (update) {
    convertStringDatesToDateObjects(update);
    if (update.$set) {
      convertStringDatesToDateObjects(update.$set);
    }
  }
  next();
});

const CompanyContact = mongoose.models['company-contact'] || mongoose.model('company-contact', schema);

export default CompanyContact;
