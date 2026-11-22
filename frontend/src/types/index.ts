
// =========================================================
// HDU CULTURAL FESTIVAL — DATABASE TYPES
// =========================================================

// ─── Admin Profile ───

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'organizer' | 'scanner';
  created_at: string;
}

// ─── Guests ───

export type GuestType =
  | 'teacher'
  | 'professor'
  | 'student'
  | 'vip'
  | 'other';

export interface Teacher {
  id: string;
  full_name: string;
  designation: string | null;
  department: string | null;
  personalized_message: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Guest {
  id: string;
  full_name: string;
  academic_title: string | null;
  institution: string | null;
  guest_type: GuestType;
  language: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  designation: string | null;
  department: string | null;
  personalized_message: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Events ───

export interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  countdown_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  event_timezone: string;
  venue: string | null;
  address: string | null;
  organizer: string | null;
  poster_url: string | null;
  background_music_url: string | null;
  schedule: Record<string, unknown> | unknown[];
  cultural_information: Record<string, unknown>;
  contact_information: Record<string, unknown>;
  status: 'draft' | 'published' | 'completed' | 'cancelled';
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Invitation Templates ───

export interface InvitationTemplate {
  id: string;
  name: string;
  description: string | null;
  design_config: Record<string, unknown>;
  preview_image: string | null;
  is_active: boolean;
  template_name: string;
  template_type: 'teacher' | 'public';
  background_url: string | null;
  editor_configuration: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type InvitationLandingPageFontKey =
  | 'university_heading'
  | 'festival_title'
  | 'tagline'
  | 'invitation_badge'
  | 'countdown_label'
  | 'venue_name'
  | 'venue_detail'
  | 'address'
  | 'dress_code'
  | 'subway_guide'
  | 'campus_gate'
  | 'campus_gate_chinese'
  | 'amap_url'
  | 'tencent_map_url'
  | 'organizer'
  | 'wechat'
  | 'email'
  | 'letter_message'
  | 'navigation'
  | 'cover_invitation'
  | 'cover_navigation'
  | 'teacher_name'
  | 'teacher_department'
  | 'event_title'
  | 'event_date'
  | 'event_time'
  | 'event_meta'
  | 'welcome_eyebrow'
  | 'welcome_heading'
  | 'welcome_body'
  | 'personal_note'
  | 'section_eyebrow'
  | 'details_heading'
  | 'details_intro'
  | 'detail_label'
  | 'detail_value'
  | 'countdown_eyebrow'
  | 'countdown_value'
  | 'countdown_unit'
  | 'location_eyebrow'
  | 'location_heading'
  | 'location_label'
  | 'rsvp_eyebrow'
  | 'rsvp_heading'
  | 'rsvp_body'
  | 'rsvp_button'
  | 'rsvp_form'
  | 'footer_eyebrow'
  | 'footer_heading'
  | 'footer_body'
  | 'footer_link';

export interface InvitationLandingPageConfig {
  font_family: string;
  font_families: Partial<Record<InvitationLandingPageFontKey, string>>;
  font_colors: Partial<Record<InvitationLandingPageFontKey, string>>;
  university_heading: string;
  festival_title: string;
  tagline: string;
  invitation_badge: string;
  countdown_label: string;
  venue_name: string;
  venue_detail: string;
  address: string;
  dress_code: string;
  subway_guide: string;
  campus_gate: string;
  campus_gate_chinese: string;
  amap_url: string;
  tencent_map_url: string;
  organizer: string;
  wechat: string;
  email: string;
  music_url: string;
  page_background_url: string;
  page_background_position: 'center' | 'top' | 'bottom' | 'left' | 'right';
  page_background_overlay: number;
  confetti_enabled: boolean;
}

export type QrLandingPageTheme = Pick<
  InvitationLandingPageConfig,
  'font_family' | 'font_families' | 'font_colors'
>;

// ─── Invitations ───

export type InvitationStatus =
  | 'pending'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'revoked';

export interface Invitation {
  id: string;
  event_id: string;
  guest_id: string;
  template_id: string | null;
  invitation_code: string;
  qr_token_hash: string | null;
  status: InvitationStatus;
  sent_at: string | null;
  qr_image_url: string | null;
  letter_content: string | null;
  animation_url: string | null;
  landing_page_config: Partial<InvitationLandingPageConfig> | null;
  created_at: string;
  updated_at: string;

  // Joined records
  teacher?: Teacher;
  guest?: Guest;
  event?: Event;
  template?: InvitationTemplate;

  // Legacy UI compatibility
  teacher_id?: string | null;
  token_hash?: string;
  invitation_status?: 'active' | 'revoked' | 'expired';
}

// ─── RSVPs ───

export interface RSVP {
  id: string;
  invitation_id: string | null;
  guest_id: string | null;
  event_id: string;
  guest_name: string | null;
  response: 'accepted' | 'maybe' | 'declined';
  guest_count: number;
  contact_information: string | null;
  invitation_category: 'teacher' | 'public';
  created_at: string;
  updated_at?: string;

  invitation?: Invitation;
  event?: Event;
  guest?: Guest;
}

// ─── Public Settings ───

export interface PublicSettings {
  id: string;
  event_id: string;
  public_token: string;
  welcome_message: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── QR Scans ───

export interface QRScan {
  id: string;
  invitation_id: string | null;
  event_id: string | null;
  invitation_category: 'teacher' | 'public' | null;
  scanned_at: string;
  scanned_by?: string | null;
}

// ─── Check-ins ───

export interface Checkin {
  id: string;
  invitation_id: string;
  checked_in_by: string | null;
  checked_in_at: string;
  notes: string | null;
}

// ─── Media Assets ───

export interface MediaAsset {
  id: string;
  event_id: string | null;
  asset_type: string | null;
  file_name: string | null;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  is_public: boolean;
  created_at: string;
}

// ─── Statistics ───

export interface DashboardStats {
  totalTeachers: number;
  totalInvitations: number;
  totalRSVPs: number;
  acceptedRSVPs: number;
  maybeRSVPs: number;
  declinedRSVPs: number;
  totalGuests: number;
  totalScans: number;
  teacherRSVPs: number;
  publicRSVPs: number;
}

export interface RSVPStats {
  accepted: number;
  maybe: number;
  declined: number;
  total: number;
  totalGuests: number;
  byCategory: {
    teacher: {
      accepted: number;
      maybe: number;
      declined: number;
    };
    public: {
      accepted: number;
      maybe: number;
      declined: number;
    };
  };
}

// ─── API Response Types ───

export interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}

export interface ValidateInvitationResponse {
  valid: boolean;
  rsvp_submitted?: boolean;
  invitation?: {
    id: string;
    status: InvitationStatus;
    created_at: string;
    guest?: Guest;
    teacher?: Teacher;
    event?: Event;
    qr_image_url?: string | null;
    letter_content?: string | null;
    animation_url?: string | null;
    landing_page_config?: Partial<InvitationLandingPageConfig> | null;
  };
  error?: string;
}

export interface SubmitRSVPRequest {
  invitation_id?: string;
  token?: string;
  event_id: string;
  guest_name?: string;
  response: 'accepted' | 'maybe' | 'declined';
  guest_count?: number;
  contact_information?: string;
  invitation_category: 'teacher' | 'public';
  token_hash?: string;
}

export interface RecordScanRequest {
  invitation_id?: string;
  event_id?: string;
  invitation_category: 'teacher' | 'public';
}

export interface AdminOpsRequest {
  action: string;
  [key: string]: unknown;
}

// ─── Form Types ───

export interface TeacherFormData {
  full_name: string;
  designation: string;
  department: string;
  personalized_message: string;
}

export interface GuestFormData {
  full_name: string;
  academic_title?: string;
  institution?: string;
  guest_type: GuestType;
  language?: string;
  email?: string;
  phone?: string;
  notes?: string;
  designation?: string;
  department?: string;
  personalized_message?: string;
}

export interface EventFormData {
  title: string;
  description: string;
  event_date: string | null;
  countdown_at: string | null;
  event_timezone: string;
  venue: string;
  organizer: string;
}

export interface RSVPFormData {
  guest_name: string;
  response: 'accepted' | 'maybe' | 'declined';
  guest_count: number;
  contact_information: string;
}
