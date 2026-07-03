import {
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export type AssignableAdminOption = {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
};

export type AssignablePartnerOption = {
  id: string;
  name: string;
  role: string;
};

export function formatReferralPartnerRole(role: string) {
  if (role === 'ADMIN') return 'Referral admin';
  return role === 'SALES_PERSON' ? 'Sales person' : 'Marketing affiliate';
}

export function formatAssignableAdminLabel(admin: AssignableAdminOption) {
  return admin.isSuperAdmin ? `${admin.name} (Super admin)` : `${admin.name} (Admin)`;
}

export function resolveAssigneeDisplayName(
  assigneeId: string,
  admins: AssignableAdminOption[],
  partners: AssignablePartnerOption[] = [],
) {
  if (!assigneeId || assigneeId === 'unassigned') return 'Unassigned';

  const admin = admins.find((entry) => entry.id === assigneeId);
  if (admin) return formatAssignableAdminLabel(admin);

  const partner = partners.find((entry) => entry.id === assigneeId);
  if (partner) {
    return `${partner.name} (${formatReferralPartnerRole(partner.role)})`;
  }

  return 'Unassigned';
}

function AssigneeOptionRow({
  name,
  detail,
}: {
  name: string;
  detail?: string;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5 py-0.5 text-left">
      <span className="truncate font-medium leading-tight">{name}</span>
      {detail ? (
        <span className="truncate text-xs font-normal text-muted-foreground leading-tight">
          {detail}
        </span>
      ) : null}
    </span>
  );
}

function GroupHeading({ children }: { children: ReactNode }) {
  return (
    <SelectLabel className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </SelectLabel>
  );
}

function GroupDivider() {
  return <SelectSeparator className="my-1.5 bg-border/80" />;
}

type AssigneeSelectOptionsProps = {
  assignableAdmins: AssignableAdminOption[];
  partners?: AssignablePartnerOption[];
  includeUnassigned?: boolean;
};

export function AssigneeSelectOptions({
  assignableAdmins,
  partners = [],
  includeUnassigned = true,
}: AssigneeSelectOptionsProps) {
  const superAdmins = assignableAdmins.filter((admin) => admin.isSuperAdmin);
  const admins = assignableAdmins.filter((admin) => !admin.isSuperAdmin);
  const salesPartners = partners.filter((partner) => partner.role === 'SALES_PERSON');
  const marketingPartners = partners.filter((partner) => partner.role === 'MARKETING_AFFILIATE');

  const hasStaffGroups =
    superAdmins.length > 0 ||
    admins.length > 0 ||
    salesPartners.length > 0 ||
    marketingPartners.length > 0;

  return (
    <>
      {includeUnassigned ? (
        <SelectItem value="unassigned" textValue="Unassigned">
          Unassigned
        </SelectItem>
      ) : null}

      {includeUnassigned && hasStaffGroups ? <GroupDivider /> : null}

      {superAdmins.length > 0 ? (
        <SelectGroup>
          <GroupHeading>Super admins</GroupHeading>
          {superAdmins.map((admin) => (
            <SelectItem
              key={admin.id}
              value={admin.id}
              textValue={`${admin.name} ${admin.email} super admin`}
            >
              <AssigneeOptionRow name={admin.name} detail={admin.email} />
            </SelectItem>
          ))}
        </SelectGroup>
      ) : null}

      {superAdmins.length > 0 && admins.length > 0 ? <GroupDivider /> : null}

      {admins.length > 0 ? (
        <SelectGroup>
          <GroupHeading>Admins</GroupHeading>
          {admins.map((admin) => (
            <SelectItem
              key={admin.id}
              value={admin.id}
              textValue={`${admin.name} ${admin.email} admin`}
            >
              <AssigneeOptionRow name={admin.name} detail={admin.email} />
            </SelectItem>
          ))}
        </SelectGroup>
      ) : null}

      {(superAdmins.length > 0 || admins.length > 0) && salesPartners.length > 0 ? (
        <GroupDivider />
      ) : null}

      {salesPartners.length > 0 ? (
        <SelectGroup>
          <GroupHeading>Sales persons</GroupHeading>
          {salesPartners.map((partner) => (
            <SelectItem
              key={`partner-${partner.id}`}
              value={partner.id}
              textValue={`${partner.name} sales person`}
            >
              <AssigneeOptionRow name={partner.name} detail="Sales person" />
            </SelectItem>
          ))}
        </SelectGroup>
      ) : null}

      {(superAdmins.length > 0 || admins.length > 0 || salesPartners.length > 0) &&
      marketingPartners.length > 0 ? (
        <GroupDivider />
      ) : null}

      {marketingPartners.length > 0 ? (
        <SelectGroup>
          <GroupHeading>Marketing affiliates</GroupHeading>
          {marketingPartners.map((partner) => (
            <SelectItem
              key={`partner-${partner.id}`}
              value={partner.id}
              textValue={`${partner.name} marketing affiliate`}
            >
              <AssigneeOptionRow name={partner.name} detail="Marketing affiliate" />
            </SelectItem>
          ))}
        </SelectGroup>
      ) : null}
    </>
  );
}

export function assigneeSelectContentClassName() {
  return cn('max-h-[min(24rem,70vh)] min-w-[18rem]');
}
