
import { supabase } from './supabase';

import type {
  Teacher,
  Guest,
  Event,
  Invitation,
  InvitationTemplate,
  RSVP,
  PublicSettings,
  QRScan,
  MediaAsset,
  DashboardStats,
  ValidateInvitationResponse,
  SubmitRSVPRequest,
  RecordScanRequest,
  AdminOpsRequest,
  TeacherFormData,
  EventFormData,
  InvitationLandingPageConfig,
} from '../types';

// =========================================================
// HELPERS
// =========================================================

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

async function adminFunctionError(error: Error): Promise<Error> {
  if ('context' in error && error.context instanceof Response) {
    try {
      const body: unknown = await error.context.clone().json();
      if (body && typeof body === 'object') {
        const responseBody = body as Record<string, unknown>;
        const message = [responseBody.error, responseBody.details]
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
          .join(': ');
        if (message) return new Error(message);
      }
    } catch {
      // Fall back to the SDK error when the response is not valid JSON.
    }
  }

  return error;
}

function mapGuestToTeacher(guest: Guest): Teacher {
  return {
    id: guest.id,
    full_name: guest.full_name,
    designation: guest.designation ?? guest.academic_title,
    department: guest.department,
    personalized_message: guest.personalized_message,
    is_active: guest.is_active,
    created_at: guest.created_at,
    updated_at: guest.updated_at,
  };
}

function mapInvitation(row: any): Invitation {
  const guest = row.guest as Guest | null;

  return {
    ...row,
    guest: guest ?? undefined,
    teacher: guest ? mapGuestToTeacher(guest) : undefined,
    teacher_id: row.guest_id,
    token_hash: row.qr_token_hash,
    invitation_status: row.status === 'revoked'
      ? 'revoked'
      : row.status === 'expired' ? 'expired' : 'active',
  } as Invitation;
}

type EventUpdateData = Partial<EventFormData> & { is_published?: boolean };

function mapEventInput(event: EventUpdateData) {
  return { ...event };
}

function mapEvent(row: any): Event {
  const isPublished = row.is_published ?? row.status === 'published';
  return {
    ...row,
    is_published: isPublished,
    status: isPublished ? 'published' : 'draft',
  } as Event;
}

// =========================================================
// EDGE FUNCTION CALLS
// =========================================================

export async function fetchInvitation(
  token: string
): Promise<ValidateInvitationResponse> {
  const { data, error } = await supabase.functions.invoke(
    'validate-invitation',
    { body: { token } }
  );

  throwIfError(error);
  return data as ValidateInvitationResponse;
}

export async function submitRSVP(
  payload: SubmitRSVPRequest
): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke(
    'submit-rsvp',
    { body: payload }
  );

  throwIfError(error);
  return data as { success: boolean };
}

export async function recordScan(
  payload: RecordScanRequest
): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke(
    'record-scan',
    { body: payload }
  );

  throwIfError(error);
  return data as { success: boolean };
}

export async function adminOps<T = unknown>(
  action: string,
  opData?: Record<string, unknown>
): Promise<T> {
  const payload: AdminOpsRequest = { action, ...opData };

  const { data, error } = await supabase.functions.invoke(
    'admin-ops',
    { body: payload }
  );

  if (error) throw await adminFunctionError(error);
  return data as T;
}

export async function changeAdminPassword(currentPassword: string, newPassword: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  const email = userData.user?.email;
  if (!email) throw new Error('The signed-in admin account does not have an email address.');

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyError) throw new Error('Current password is incorrect.');

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) throw new Error(updateError.message);
}

export async function fetchAppLogo(): Promise<string> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('setting_value')
    .eq('setting_key', 'app_logo_url')
    .maybeSingle();

  throwIfError(error);
  return data?.setting_value ?? '';
}

export async function saveAppLogo(url: string): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ setting_key: 'app_logo_url', setting_value: url }, { onConflict: 'setting_key' });

  throwIfError(error);
}

export async function uploadAppLogo(file: File): Promise<string> {
  const extensions: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  };
  const extension = extensions[file.type];
  if (!extension) throw new Error('Choose a PNG, JPG, or WebP logo image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('The app logo must be 5 MB or smaller.');

  const path = `app-assets/logo/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await supabase.storage
    .from('media')
    .upload(path, file, { contentType: file.type, cacheControl: '3600' });

  if (error) throw new Error(error.message);
  if (!data) throw new Error('The app logo upload did not return a file path.');
  return supabase.storage.from('media').getPublicUrl(data.path).data.publicUrl;
}

// =========================================================
// GUESTS / TEACHERS
// =========================================================

// The existing teacher interface is retained for the current UI.
// Teachers and professors are records in the unified guests table.

export async function fetchTeachers(): Promise<Teacher[]> {
  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .in('guest_type', ['teacher', 'professor'])
    .order('full_name');

  throwIfError(error);

  return ((data ?? []) as Guest[]).map(mapGuestToTeacher);
}

export async function fetchGuests(): Promise<Guest[]> {
  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .order('full_name');

  throwIfError(error);
  return (data ?? []) as Guest[];
}

export async function fetchTeacher(id: string): Promise<Teacher> {
  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .eq('id', id)
    .single();

  throwIfError(error);
  return mapGuestToTeacher(data as Guest);
}

export async function createTeacher(
  teacher: TeacherFormData
): Promise<Teacher> {
  const { data, error } = await supabase
    .from('guests')
    .insert(mapTeacherInput(teacher))
    .select()
    .single();

  throwIfError(error);
  return mapGuestToTeacher(data as Guest);
}

function mapTeacherInput(teacher: TeacherFormData) {
  return {
    full_name: teacher.full_name,
    designation: teacher.designation || null,
    academic_title: teacher.designation || null,
    department: teacher.department || null,
    personalized_message: teacher.personalized_message || null,
    guest_type: 'teacher' as const,
    is_active: true,
  };
}

export async function createTeachers(
  teachers: TeacherFormData[]
): Promise<Teacher[]> {
  if (!teachers.length) return [];

  const { data, error } = await supabase
    .from('guests')
    .insert(teachers.map(mapTeacherInput))
    .select();

  throwIfError(error);
  return ((data ?? []) as Guest[]).map(mapGuestToTeacher);
}

export async function createGuest(
  guest: Partial<Guest> & Pick<Guest, 'full_name' | 'guest_type'>
): Promise<Guest> {
  const { data, error } = await supabase
    .from('guests')
    .insert(guest)
    .select()
    .single();

  throwIfError(error);
  return data as Guest;
}

export async function updateTeacher(
  id: string,
  teacher: Partial<TeacherFormData>
): Promise<Teacher> {
  const updates: Record<string, unknown> = { ...teacher };

  if (teacher.designation !== undefined) {
    updates.academic_title = teacher.designation;
  }

  const { data, error } = await supabase
    .from('guests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  throwIfError(error);
  return mapGuestToTeacher(data as Guest);
}

export async function updateGuest(
  id: string,
  updates: Partial<Guest>
): Promise<Guest> {
  const { data, error } = await supabase
    .from('guests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  throwIfError(error);
  return data as Guest;
}

// Soft deletion preserves historical invitations and RSVP records.
export async function deleteTeacher(id: string): Promise<void> {
  const { error } = await supabase
    .from('guests')
    .update({ is_active: false })
    .eq('id', id);

  throwIfError(error);
}

// =========================================================
// EVENTS
// =========================================================

export async function fetchEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });

  throwIfError(error);

  return (data ?? []).map(mapEvent);
}

export async function fetchEvent(id: string): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();

  throwIfError(error);

  return mapEvent(data);
}

export async function createEvent(
  event: EventFormData
): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      ...event,
      is_published: false,
      event_timezone: event.event_timezone || 'Asia/Shanghai',
    })
    .select()
    .single();

  throwIfError(error);

  return mapEvent(data);
}

export async function updateEvent(
  id: string,
  event: EventUpdateData
): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .update(mapEventInput(event))
    .eq('id', id)
    .select()
    .single();

  throwIfError(error);

  return mapEvent(data);
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id);

  throwIfError(error);
}

// =========================================================
// INVITATIONS
// =========================================================

export async function fetchInvitations(): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select(`
      *,
      guest:guests(*),
      event:events(*),
      template:invitation_templates(*)
    `)
    .order('created_at', { ascending: false });

  throwIfError(error);

  return (data ?? []).map(mapInvitation);
}

export async function createInvitation(invitation: {
  guest_id: string;
  event_id: string;
  template_id?: string;
  invitation_code: string;
  qr_token_hash: string;
}): Promise<Invitation> {
  const { data, error } = await supabase
    .from('invitations')
    .insert(invitation)
    .select()
    .single();

  throwIfError(error);
  return mapInvitation(data);
}

export async function updateInvitation(
  id: string,
  updates: Partial<Pick<
    Invitation,
    'template_id' | 'qr_image_url'
  >> & { invitation_status?: 'active' | 'revoked' | 'expired' }
): Promise<Invitation> {
  const databaseUpdates: Record<string, unknown> = {
    template_id: updates.template_id,
    qr_image_url: updates.qr_image_url,
  };

  if (updates.invitation_status === 'revoked') {
    databaseUpdates.status = 'revoked';
  } else if (updates.invitation_status === 'active') {
    databaseUpdates.status = 'sent';
  }

  Object.keys(databaseUpdates).forEach((key) => {
    if (databaseUpdates[key] === undefined) {
      delete databaseUpdates[key];
    }
  });

  const { data, error } = await supabase
    .from('invitations')
    .update(databaseUpdates)
    .eq('id', id)
    .select(`
      *,
      guest:guests(*),
      event:events(*),
      template:invitation_templates(*)
    `)
    .single();

  throwIfError(error);
  return mapInvitation(data);
}

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await supabase
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', id);

  throwIfError(error);
}

export async function deleteInvitation(id: string): Promise<void> {
  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', id);

  throwIfError(error);
}

export async function saveInvitationLetterDesign(
  id: string,
  updates: {
    letter_content: string | null;
    landing_page_config: InvitationLandingPageConfig;
  }
): Promise<Pick<Invitation, 'letter_content' | 'landing_page_config'>> {
  const { data, error } = await supabase
    .from('invitations')
    .update(updates)
    .eq('id', id)
    .select('letter_content, landing_page_config')
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('The invitation letter could not be saved.');
  return data;
}

export async function uploadInvitationPageAsset(
  invitationId: string,
  file: File,
  assetType: 'music' | 'background'
): Promise<string> {
  const allowedTypes = assetType === 'music'
    ? ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
    : ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];
  const maxBytes = assetType === 'background' ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
  if (!allowedTypes.includes(file.type)) {
    throw new Error(assetType === 'music'
      ? 'Choose an MP3, WAV, OGG, or WebM audio file.'
      : 'Choose a PNG, JPG, WebP, animated GIF, MP4, or WebM page background.');
  }
  if (file.size > maxBytes) {
    const limit = assetType === 'background' ? 50 : 20;
    throw new Error(`The ${assetType} file exceeds the ${limit} MB limit.`);
  }

  const extensions: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  };
  const extension = extensions[file.type];
  const path = `invitation-pages/${invitationId}/${assetType}-${crypto.randomUUID()}.${extension}`;
  const { data, error } = await supabase.storage
    .from('media')
    .upload(path, file, { contentType: file.type, cacheControl: '3600' });

  if (error) throw new Error(error.message);
  if (!data) throw new Error(`The ${assetType} upload did not return a file path.`);
  return supabase.storage.from('media').getPublicUrl(data.path).data.publicUrl;
}

// =========================================================
// RSVPS
// =========================================================

export async function fetchRSVPs(
  eventId?: string
): Promise<RSVP[]> {
  let query = supabase
    .from('rsvps')
    .select(`
      *,
      invitation:invitations(*, guest:guests(*)),
      event:events(*),
      guest:guests(*)
    `)
    .order('created_at', { ascending: false });

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  const { data, error } = await query;

  throwIfError(error);
  return (data ?? []) as RSVP[];
}

// =========================================================
// INVITATION TEMPLATES
// =========================================================

export async function fetchTemplates(): Promise<InvitationTemplate[]> {
  const { data, error } = await supabase
    .from('invitation_templates')
    .select('*')
    .order('created_at', { ascending: false });

  throwIfError(error);

  return (data ?? []).map((row: any) => ({
    ...row,
    template_name: row.name,
    background_url: row.preview_image ?? row.background_url,
    editor_configuration: row.design_config ?? {},
  })) as InvitationTemplate[];
}

export async function createTemplate(template: {
  template_name: string;
  template_type: 'teacher' | 'public';
  background_url?: string;
  editor_configuration?: Record<string, unknown>;
}): Promise<InvitationTemplate> {
  const { data, error } = await supabase
    .from('invitation_templates')
    .insert({
      name: template.template_name,
      template_type: template.template_type,
      preview_image: template.background_url ?? null,
      design_config: template.editor_configuration ?? {},
      is_active: true,
    })
    .select()
    .single();

  throwIfError(error);

  return {
    ...data,
    template_name: data.name,
    background_url: data.preview_image,
    editor_configuration: data.design_config,
  } as InvitationTemplate;
}

export async function updateTemplate(
  id: string,
  updates: Partial<InvitationTemplate>
): Promise<InvitationTemplate> {
  const databaseUpdates: Record<string, unknown> = {};

  if (updates.template_name !== undefined) {
    databaseUpdates.name = updates.template_name;
  }

  if (updates.template_type !== undefined) {
    databaseUpdates.template_type = updates.template_type;
  }

  if (updates.background_url !== undefined) {
    databaseUpdates.preview_image = updates.background_url;
  }

  if (updates.editor_configuration !== undefined) {
    databaseUpdates.design_config = updates.editor_configuration;
  }

  if (updates.is_active !== undefined) {
    databaseUpdates.is_active = updates.is_active;
  }

  if (updates.description !== undefined) {
    databaseUpdates.description = updates.description;
  }

  const { data, error } = await supabase
    .from('invitation_templates')
    .update(databaseUpdates)
    .eq('id', id)
    .select()
    .single();

  throwIfError(error);

  return {
    ...data,
    template_name: data.name,
    background_url: data.preview_image,
    editor_configuration: data.design_config,
  } as InvitationTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('invitation_templates')
    .delete()
    .eq('id', id);

  throwIfError(error);
}

// =========================================================
// PUBLIC SETTINGS
// =========================================================

export async function fetchPublicSettings(
  eventId: string
): Promise<PublicSettings | null> {
  const { data, error } = await supabase
    .from('public_settings')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle();

  throwIfError(error);
  return data as PublicSettings | null;
}

export async function fetchPublicInvitation(publicToken: string): Promise<{
  settings: PublicSettings;
  event: Event;
}> {
  const { data, error } = await supabase
    .from('public_settings')
    .select('*, event:events(*)')
    .eq('public_token', publicToken)
    .eq('is_active', true)
    .maybeSingle();

  throwIfError(error);
  if (!data) throw new Error('This public invitation is not available.');

  return {
    settings: data as PublicSettings,
    event: (data as PublicSettings & { event: Event }).event,
  };
}

export async function createPublicSettings(
  eventId: string,
  settings: Pick<PublicSettings, 'welcome_message' | 'is_active'>
): Promise<PublicSettings> {
  const { data, error } = await supabase
    .from('public_settings')
    .insert({
      event_id: eventId,
      public_token: crypto.randomUUID(),
      ...settings,
    })
    .select()
    .single();

  throwIfError(error);
  return data as PublicSettings;
}

export async function updatePublicSettings(
  id: string,
  updates: Partial<PublicSettings>
): Promise<PublicSettings> {
  const { data, error } = await supabase
    .from('public_settings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  throwIfError(error);
  return data as PublicSettings;
}

// =========================================================
// QR SCANS
// =========================================================

export async function fetchQRScans(
  eventId?: string
): Promise<QRScan[]> {
  let query = supabase
    .from('qr_scans')
    .select('*')
    .order('scanned_at', { ascending: false });

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  const { data, error } = await query;

  throwIfError(error);
  return (data ?? []) as QRScan[];
}

// =========================================================
// MEDIA ASSETS
// =========================================================

export async function fetchMediaAssets(
  eventId: string
): Promise<MediaAsset[]> {
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  throwIfError(error);
  return (data ?? []) as MediaAsset[];
}

// =========================================================
// DASHBOARD STATISTICS
// =========================================================

export async function fetchDashboardStats(
  eventId: string
): Promise<DashboardStats> {
  const [
    teachers,
    invitations,
    rsvps,
    scans,
  ] = await Promise.all([
    supabase
      .from('guests')
      .select('id', { count: 'exact', head: true })
      .in('guest_type', ['teacher', 'professor'])
      .eq('is_active', true),

    supabase
      .from('invitations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId),

    supabase
      .from('rsvps')
      .select('*')
      .eq('event_id', eventId),

    supabase
      .from('qr_scans')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId),
  ]);

  const queryError =
    teachers.error ||
    invitations.error ||
    rsvps.error ||
    scans.error;

  throwIfError(queryError);

  const rsvpData = (rsvps.data ?? []) as RSVP[];

  const accepted = rsvpData.filter(
    (r) => r.response === 'accepted'
  );

  const maybe = rsvpData.filter(
    (r) => r.response === 'maybe'
  );

  const declined = rsvpData.filter(
    (r) => r.response === 'declined'
  );

  const teacherRsvps = rsvpData.filter(
    (r) => r.invitation_category === 'teacher'
  );

  const publicRsvps = rsvpData.filter(
    (r) => r.invitation_category === 'public'
  );

  return {
    totalTeachers: teachers.count ?? 0,
    totalInvitations: invitations.count ?? 0,
    totalRSVPs: rsvpData.length,
    acceptedRSVPs: accepted.length,
    maybeRSVPs: maybe.length,
    declinedRSVPs: declined.length,
    totalGuests: rsvpData.reduce(
      (sum, r) => sum + r.guest_count,
      0
    ),
    totalScans: scans.count ?? 0,
    teacherRSVPs: teacherRsvps.length,
    publicRSVPs: publicRsvps.length,
  };
}
