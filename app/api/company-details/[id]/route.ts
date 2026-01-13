import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Company from '@/lib/models/Company';
import User from '@/lib/models/User';
import CompanyContact from '@/lib/models/CompanyContact';
import Campaign from '@/lib/models/Campaign';
import { USER_KIND, CAMPAIGN_STATUS } from '@/lib/constants';

const COMPANY_CONTACT_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE", 
  DELETED: "DELETED",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid company ID' },
        { status: 400 }
      );
    }

    // Connect to database if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/circles');
    }

    const company = await Company.findById(id).lean();
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found!' },
        { status: 404 }
      );
    }

    const [
      primaryUsers,
      secondaryUsers,
      totalContacts,
      activeContacts,
      deletedContacts,
      inactiveContacts,
      campaignStats,
    ] = await Promise.all([
      // Primary users (exclude deleted)
      User.find({
        company: id,
        kind: USER_KIND.PRIMARY,
        status: { $ne: "DELETED" },
      })
        .select("emailAddress firstName lastName phoneNumber profilePicture createdAt status")
        .lean(),
      
      // Secondary users (exclude deleted)
      User.find({
        company: id,
        kind: USER_KIND.SECONDARY,
        status: { $ne: "DELETED" },
      })
        .select("emailAddress firstName lastName phoneNumber profilePicture createdAt status")
        .lean(),
      
      // Total contacts
      CompanyContact.countDocuments({
        public_circles_company: id,
      }),
      
      // Active contacts
      CompanyContact.countDocuments({
        public_circles_company: id,
        public_circles_status: COMPANY_CONTACT_STATUS.ACTIVE,
      }),
      
      // Deleted contacts
      CompanyContact.countDocuments({
        public_circles_company: id,
        public_circles_status: COMPANY_CONTACT_STATUS.DELETED,
      }),
      
      // Inactive contacts
      CompanyContact.countDocuments({
        public_circles_company: id,
        public_circles_status: COMPANY_CONTACT_STATUS.INACTIVE,
      }),
      
      // Campaign statistics
      Campaign.aggregate([
        {
          $match: {
            company: new mongoose.Types.ObjectId(id),
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: {
                $cond: [
                  { $eq: ["$status", CAMPAIGN_STATUS.ACTIVE] },
                  1,
                  0,
                ],
              },
            },
            draft: {
              $sum: {
                $cond: [
                  { $eq: ["$status", CAMPAIGN_STATUS.DRAFT] },
                  1,
                  0,
                ],
              },
            },
            paused: {
              $sum: {
                $cond: [
                  { $eq: ["$status", CAMPAIGN_STATUS.PAUSED] },
                  1,
                  0,
                ],
              },
            },
            archived: {
              $sum: {
                $cond: [
                  { $eq: ["$status", CAMPAIGN_STATUS.ARCHIVED] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const campaignData = campaignStats[0] || {
      total: 0,
      active: 0,
      draft: 0,
      paused: 0,
      archived: 0,
    };

    const response = {
      company: {
        id: company._id,
        name: company.name,
        email: company.emailKey,
        logo: company.logo,
        status: company.status,
        createdAt: company.createdAt,
      },
      users: {
        primary: primaryUsers,
        secondary: secondaryUsers,
        totalUsers: primaryUsers.length + secondaryUsers.length,
      },
      contacts: {
        total: totalContacts,
        active: activeContacts,
        deleted: deletedContacts,
        inactive: inactiveContacts,
      },
      campaigns: campaignData,
    };

    return NextResponse.json({
      message: "Company details fetched successfully",
      data: response,
    });
  } catch (error) {
    console.error('Error fetching company details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
