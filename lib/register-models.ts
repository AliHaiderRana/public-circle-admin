import Company from './models/Company';
import User from './models/User';
import CustomerRequest from './models/CustomerRequest';
import Feedback from './models/Feedback';
import AdminUser from './models/AdminUser';
import AppConfig from './models/AppConfig';
import Campaign from './models/Campaign';
import CampaignRun from './models/CampaignRun';
import EmailsSent from './models/EmailsSent';
import CompanyContact from './models/CompanyContact';
import Template from './models/Template';
import TemplateCategory from './models/TemplateCategory';
import EditorAsset from './models/EditorAsset';
import Plan from './models/Plan';
import AdminActivity from './models/AdminActivity';
import AdminImpersonationActivity from './models/AdminImpersonationActivity';
import CronHistory from './models/CronHistory';
import SupportRequest from './models/SupportRequest';

export function registerModels() {
  // Accessing the models ensures they are registered with Mongoose
  return {
    Company,
    User,
    CustomerRequest,
    Feedback,
    AdminUser,
    AppConfig,
    Campaign,
    CampaignRun,
    EmailsSent,
    CompanyContact,
    Template,
    TemplateCategory,
    EditorAsset,
    Plan,
    AdminActivity,
    AdminImpersonationActivity,
    CronHistory,
    SupportRequest,
  };
}
