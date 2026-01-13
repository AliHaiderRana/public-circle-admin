import Company from './models/Company';
import User from './models/User';
import CustomerRequest from './models/CustomerRequest';
import AdminUser from './models/AdminUser';
import AppConfig from './models/AppConfig';
import Campaign from './models/Campaign';
import CampaignRun from './models/CampaignRun';
import EmailsSent from './models/EmailsSent';
import CompanyContact from './models/CompanyContact';
import CronMetadata from './models/CronMetadata';

export function registerModels() {
  // Accessing the models ensures they are registered with Mongoose
  return {
    Company,
    User,
    CustomerRequest,
    AdminUser,
    AppConfig,
    Campaign,
    CampaignRun,
    EmailsSent,
    CompanyContact,
    CronMetadata
  };
}
