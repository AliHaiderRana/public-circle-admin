import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Company from '@/lib/models/Company';
import Campaign from '@/lib/models/Campaign';
import CompanyContact from '@/lib/models/CompanyContact';
import { getServerSession } from '@/lib/auth';
import {
  isPartnerSession,
  partnerCompaniesFilter,
  sanitizeCompanyForPartner,
} from '@/lib/partner-access.util';

type CompanyDoc = {
  _id: { toString(): string };
  name?: string;
  city?: string;
  country?: string;
  companySize?: string;
  status?: string;
  logo?: string;
  createdAt?: Date | string;
  [key: string]: unknown;
};

async function attachCounts(companies: CompanyDoc[]) {
  if (!companies.length) return [];

  const companyIds = companies.map((company) => company._id);

  const [campaignCounts, contactCounts] = await Promise.all([
    Campaign.aggregate([
      { $match: { company: { $in: companyIds } } },
      { $group: { _id: '$company', count: { $sum: 1 } } },
    ]),
    CompanyContact.aggregate([
      { $match: { public_circles_company: { $in: companyIds } } },
      { $group: { _id: '$public_circles_company', count: { $sum: 1 } } },
    ]),
  ]);

  const campaignCountMap = new Map<string, number>();
  const contactCountMap = new Map<string, number>();

  campaignCounts.forEach((item) => {
    campaignCountMap.set(String(item._id), item.count);
  });

  contactCounts.forEach((item) => {
    contactCountMap.set(String(item._id), item.count);
  });

  return companies.map((company) => {
    const companyId = company._id.toString();
    return {
      ...company,
      _id: companyId,
      campaignCount: campaignCountMap.get(companyId) || 0,
      contactCount: contactCountMap.get(companyId) || 0,
    };
  });
}

function sortCompanies(
  companies: Array<CompanyDoc & { campaignCount?: number; contactCount?: number }>,
  sortBy: string,
  sortOrder: 1 | -1,
) {
  return [...companies].sort((a, b) => {
    if (sortBy === 'campaignCount' || sortBy === 'contactCount') {
      const aValue = Number(a[sortBy as 'campaignCount' | 'contactCount'] || 0);
      const bValue = Number(b[sortBy as 'campaignCount' | 'contactCount'] || 0);
      return sortOrder === 1 ? aValue - bValue : bValue - aValue;
    }

    const aValue = a[sortBy] ?? '';
    const bValue = b[sortBy] ?? '';

    if (sortBy === 'createdAt') {
      const aDate = new Date(String(aValue)).getTime();
      const bDate = new Date(String(bValue)).getTime();
      return sortOrder === 1 ? aDate - bDate : bDate - aDate;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 1 ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }

    return sortOrder === 1 ? (aValue > bValue ? 1 : -1) : aValue < bValue ? 1 : -1;
  });
}

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10), 1), 100);
    const search = searchParams.get('search') || '';
    const companySize = searchParams.get('companySize') || '';
    const country = searchParams.get('country') || '';
    const status = searchParams.get('status') || '';
    const city = searchParams.get('city') || '';
    const sort = searchParams.get('sort') || 'desc';
    const sortBy = searchParams.get('sortBy') || 'createdAt';

    const query: Record<string, unknown> = {};
    const partnerFilter = isPartnerSession(session)
      ? await partnerCompaniesFilter(session)
      : {};

    if (Object.keys(partnerFilter).length) {
      Object.assign(query, partnerFilter);
    }

    const searchRaw = search.trim();
    const searchTokens = searchRaw
      ? searchRaw.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean)
      : [];
    const exactIdTokens = searchTokens.filter(
      (t) => /^[a-fA-F0-9]{24}$/.test(t) && mongoose.Types.ObjectId.isValid(t)
    );
    const exactObjectIds = exactIdTokens.map((t) => new mongoose.Types.ObjectId(t));
    const remainingTokens = searchTokens.filter((t) => !exactIdTokens.includes(t));
    const partialIdToken =
      remainingTokens.length === 1 && /^[a-fA-F0-9]{4,23}$/.test(remainingTokens[0])
        ? remainingTokens[0]
        : null;
    const textSearch = partialIdToken ? '' : remainingTokens.join(' ');

    if (exactObjectIds.length || textSearch || partialIdToken) {
      const or: Record<string, unknown>[] = [];

      if (exactObjectIds.length) {
        or.push({ _id: { $in: exactObjectIds } });
      }

      if (textSearch) {
        or.push(
          { name: { $regex: textSearch, $options: 'i' } },
          { city: { $regex: textSearch, $options: 'i' } },
          { country: { $regex: textSearch, $options: 'i' } },
          { address: { $regex: textSearch, $options: 'i' } },
          { postalCode: { $regex: textSearch, $options: 'i' } },
          { companySize: { $regex: textSearch, $options: 'i' } },
        );
      }

      // Partial ObjectId prefix match (hex only). Keep this out of distinct() queries.
      if (partialIdToken) {
        or.push({
          $expr: {
            $regexMatch: {
              input: { $toString: '$_id' },
              regex: `^${partialIdToken}`,
              options: 'i',
            },
          },
        });
      }

      if (or.length) query.$or = or;
    }

    if (companySize) query.companySize = companySize;
    if (country) query.country = country;
    if (city) query.city = city;
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const sortOrder: 1 | -1 = sort === 'asc' ? 1 : -1;

    // distinct() can fail / be unreliable with $expr — strip it for facet filters only
    const distinctQuery: Record<string, unknown> = { ...query };
    if (Array.isArray(distinctQuery.$or)) {
      const withoutExpr = (distinctQuery.$or as Record<string, unknown>[]).filter(
        (clause) => !('$expr' in clause)
      );
      if (withoutExpr.length) distinctQuery.$or = withoutExpr;
      else delete distinctQuery.$or;
    }

    const [totalCount, distinctCountries, distinctSizes, distinctCities] = await Promise.all([
      Company.countDocuments(query),
      Company.distinct('country', distinctQuery),
      Company.distinct('companySize', distinctQuery),
      Company.distinct('city', distinctQuery),
    ]);

    let companies;

    if (sortBy === 'campaignCount' || sortBy === 'contactCount') {
      const allCompanies = await Company.find(query).lean();
      const withCounts = await attachCounts(allCompanies as CompanyDoc[]);
      companies = sortCompanies(withCounts, sortBy, sortOrder).slice(skip, skip + limit);
    } else {
      const mongoSort = { [sortBy]: sortOrder } as Record<string, 1 | -1>;
      const pageCompanies = await Company.find(query)
        .sort(mongoSort)
        .skip(skip)
        .limit(limit)
        .lean();
      companies = await attachCounts(pageCompanies as CompanyDoc[]);
    }

    const responseCompanies = isPartnerSession(session)
      ? companies.map((company) => sanitizeCompanyForPartner(company as Record<string, unknown>))
      : companies;

    return NextResponse.json({
      companies: responseCompanies,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
      filters: {
        countries: distinctCountries.filter(Boolean).sort(),
        sizes: distinctSizes.filter(Boolean).sort(),
        cities: distinctCities.filter(Boolean).sort(),
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching companies:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch companies',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
