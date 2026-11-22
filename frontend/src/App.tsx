import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clipboard,
  ClipboardCheck,
  Copy,
  Download,
  DoorOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  Printer,
  Plus,
  QrCode,
  Send,
  Settings,
  Ticket,
  Trash2,
  Upload,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { AuthProvider, ProtectedRoute, useAuth } from './context/AuthContext';
import {
  adminOps,
  createEvent,
  createTeachers,
  deleteEvent,
  fetchDashboardStats,
  fetchEvents,
  fetchInvitations,
  fetchRSVPs,
  createTeacher,
  changeAdminPassword,
  fetchAppLogo,
  fetchTeachers,
  fetchInvitation,
  deleteInvitation,
  deleteTeacher,
  fetchPublicInvitation,
  fetchWeChatNickname,
  fetchPublicSettings,
  fetchQrLandingPageTheme,
  saveInvitationLetterDesign,
  saveQrLandingPageTheme,
  saveAppLogo,
  submitRSVP,
  createPublicSettings,
  uploadAppLogo,
  updateTeacher,
  uploadInvitationPageAsset,
  updateEvent,
  updateInvitation,
  updatePublicSettings,
  getWeChatAuthorizationUrl,
} from './services/api';
import type { DashboardStats, Event, EventFormData, Invitation, InvitationLandingPageConfig, InvitationLandingPageFontKey, PublicSettings, QrLandingPageTheme, RSVP, Teacher, TeacherFormData, ValidateInvitationResponse } from './types';

const navigation = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
  { label: 'Invitations', to: '/admin/invitations', icon: Ticket },
  { label: 'Teachers', to: '/admin/teachers', icon: Users },
  { label: 'RSVPs', to: '/admin/rsvps', icon: ClipboardCheck },
  { label: 'Event settings', to: '/admin/event-settings', icon: Settings },
  { label: 'Settings', to: '/admin/settings', icon: Settings },
];

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

interface AppBrandingContextValue {
  logoUrl: string;
  setLogoUrl: (url: string) => void;
  logoError: string;
}

const AppBrandingContext = createContext<AppBrandingContextValue | null>(null);

function AppBrandingProvider({ children }: { children: ReactNode }) {
  const [logoUrl, setLogoUrl] = useState('');
  const [logoError, setLogoError] = useState('');

  useEffect(() => {
    fetchAppLogo()
      .then(setLogoUrl)
      .catch((cause) => {
        console.error('Could not load shared app logo:', cause);
        setLogoError(messageFrom(cause));
      });
  }, []);

  function updateLogoUrl(url: string) {
    setLogoUrl(url);
    setLogoError('');
  }

  return (
    <AppBrandingContext.Provider value={{ logoUrl, setLogoUrl: updateLogoUrl, logoError }}>
      {children}
    </AppBrandingContext.Provider>
  );
}

function useAppBranding(): AppBrandingContextValue {
  const context = useContext(AppBrandingContext);
  if (!context) throw new Error('useAppBranding must be used inside AppBrandingProvider');
  return context;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function isVideoAnimation(url: string): boolean {
  return /\.(mp4|webm)(?:[?#].*)?$/i.test(url);
}

function isWeChatBrowser(): boolean {
  return /micromessenger/i.test(navigator.userAgent);
}

const defaultLandingPageConfig: InvitationLandingPageConfig = {
  font_family: '',
  font_families: {},
  font_colors: {},
  university_heading: 'HANGZHOU DIANZI UNIVERSITY • 杭州电子科技大学',
  festival_title: 'HDU Bangladeshi Cultural Festival 2026',
  tagline: 'Celebrating Heritage, Friendship & Academic Harmony at Hangzhou Dianzi University',
  invitation_badge: '👑 VIP Distinguished Faculty Invitation',
  countdown_label: 'FESTIVAL INAUGURATION COUNTDOWN',
  venue_name: 'HDU Academic Exchange Center (杭州电子科技大学学术交流中心)',
  venue_detail: 'Grand Auditorium, 3rd Floor (三楼大礼堂)',
  address: 'No. 1158, 2nd Avenue, Xiasha Higher Education Zone, Qiantang District',
  dress_code: 'Traditional Bangladeshi / Formal Academic / Smart Casual',
  subway_guide: 'Hangzhou Metro Line 1, Wenze Road Station (文泽路站), Exit A. 10 minutes walk to HDU South Gate.',
  campus_gate: 'No. 1158, 2nd Avenue, Xiasha Higher Education Zone, Qiantang District',
  campus_gate_chinese: '下沙高教园区2号大街1158号',
  amap_url: 'https://uri.amap.com/search?keyword=HDU%20Academic%20Exchange%20Center&city=Hangzhou',
  tencent_map_url: 'https://map.qq.com/?q=Hangzhou%20Dianzi%20University',
  organizer: 'Bangladesh International Student Community, Hangzhou Dianzi University (HDU), Hangzhou, China',
  wechat: 'HDU_BanglaFest',
  email: 'banglafest@hdu.edu.cn',
  music_url: '',
  page_background_url: '',
  page_background_position: 'center',
  page_background_overlay: 48,
  confetti_enabled: true,
};

const defaultQrLandingPageTheme: QrLandingPageTheme = {
  font_family: '',
  font_families: {},
  font_colors: {},
};

const wordFontFamilySuggestions = [
  'Aptos',
  'Aptos Display',
  'Arial',
  'Arial Black',
  'Arial Narrow',
  'Bahnschrift',
  'Baskerville Old Face',
  'Bell MT',
  'Book Antiqua',
  'Bookman Old Style',
  'Calibri',
  'Calibri Light',
  'Cambria',
  'Cambria Math',
  'Candara',
  'Century Gothic',
  'Comic Sans MS',
  'Consolas',
  'Constantia',
  'Corbel',
  'Courier New',
  'Franklin Gothic',
  'Garamond',
  'Georgia',
  'Gill Sans MT',
  'Edwardian Script ITC',
  'Impact',
  'Lucida Console',
  'Lucida Sans Unicode',
  'Microsoft Sans Serif',
  'Montserrat',
  'Palatino Linotype',
  'Segoe Print',
  'Segoe Script',
  'Segoe UI',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
];

const landingPageFontKeys: InvitationLandingPageFontKey[] = [
  'university_heading',
  'festival_title',
  'tagline',
  'invitation_badge',
  'countdown_label',
  'venue_name',
  'venue_detail',
  'address',
  'dress_code',
  'subway_guide',
  'campus_gate',
  'campus_gate_chinese',
  'amap_url',
  'tencent_map_url',
  'organizer',
  'wechat',
  'email',
  'letter_message',
  'navigation',
  'cover_invitation',
  'cover_navigation',
  'teacher_name',
  'teacher_department',
  'event_title',
  'event_date',
  'event_time',
  'event_meta',
  'welcome_eyebrow',
  'welcome_heading',
  'welcome_body',
  'personal_note',
  'section_eyebrow',
  'details_heading',
  'details_intro',
  'detail_label',
  'detail_value',
  'countdown_eyebrow',
  'countdown_value',
  'countdown_unit',
  'location_eyebrow',
  'location_heading',
  'location_label',
  'rsvp_eyebrow',
  'rsvp_heading',
  'rsvp_body',
  'rsvp_button',
  'rsvp_form',
  'footer_eyebrow',
  'footer_heading',
  'footer_body',
  'footer_link',
];

const landingPageExtraFontFields: Array<{ key: InvitationLandingPageFontKey; label: string }> = [
  { key: 'navigation', label: 'Navigation links' },
  { key: 'cover_invitation', label: 'Cover invitation line' },
  { key: 'cover_navigation', label: 'Cover scroll link' },
  { key: 'teacher_name', label: 'Teacher name' },
  { key: 'teacher_department', label: 'Teacher department' },
  { key: 'event_title', label: 'Event title' },
  { key: 'event_date', label: 'Event date' },
  { key: 'event_time', label: 'Event time' },
  { key: 'event_meta', label: 'Event timezone and metadata' },
  { key: 'welcome_eyebrow', label: 'Welcome section eyebrow' },
  { key: 'welcome_heading', label: 'Welcome heading' },
  { key: 'welcome_body', label: 'Welcome text' },
  { key: 'personal_note', label: 'Personalized teacher note' },
  { key: 'section_eyebrow', label: 'Section eyebrows' },
  { key: 'details_heading', label: 'Event details heading' },
  { key: 'details_intro', label: 'Event details introduction' },
  { key: 'detail_label', label: 'Event detail labels' },
  { key: 'detail_value', label: 'Event detail values' },
  { key: 'countdown_eyebrow', label: 'Countdown eyebrow' },
  { key: 'countdown_value', label: 'Countdown numbers' },
  { key: 'countdown_unit', label: 'Countdown units' },
  { key: 'location_eyebrow', label: 'Location eyebrow' },
  { key: 'location_heading', label: 'Location heading' },
  { key: 'location_label', label: 'Location labels' },
  { key: 'rsvp_eyebrow', label: 'RSVP eyebrow' },
  { key: 'rsvp_heading', label: 'RSVP headings' },
  { key: 'rsvp_body', label: 'RSVP text' },
  { key: 'rsvp_button', label: 'RSVP buttons' },
  { key: 'rsvp_form', label: 'RSVP form labels and fields' },
  { key: 'footer_eyebrow', label: 'Footer eyebrow' },
  { key: 'footer_heading', label: 'Footer heading' },
  { key: 'footer_body', label: 'Footer text' },
  { key: 'footer_link', label: 'Footer link' },
];

function fontFamilyValue(fontFamily: string): string {
  return fontFamily.trim().toLowerCase() === 'edwardian script itc'
    ? '"Edwardian Script ITC", cursive'
    : fontFamily.trim();
}

function FontFamilyPicker({
  label,
  value,
  onChange,
  color,
  onColorChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  color?: string;
  onColorChange?: (value: string) => void;
}) {
  const fontPicker = (
    <label className="font-family-picker">
      {label}
      <input
        type="text"
        list="word-font-family-suggestions"
        value={value}
        placeholder="Use default font"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );

  if (!onColorChange) return fontPicker;

  return (
    <div className="font-style-picker">
      {fontPicker}
      <div className="font-color-picker">
        <span>{label.replace(/ font$/i, '')} color</span>
        <div>
          <input
            type="checkbox"
            checked={Boolean(color)}
            aria-label={`Set ${label.replace(/ font$/i, '')} color`}
            onChange={(event) => onColorChange(event.target.checked ? '#17352e' : '')}
          />
          <input
            type="color"
            value={color || '#17352e'}
            disabled={!color}
            aria-label={`${label.replace(/ font$/i, '')} color value`}
            onChange={(event) => onColorChange(event.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

async function parseTeacherWorkbook(file: File): Promise<{ teachers: TeacherFormData[]; skippedRows: number[] }> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('The workbook does not contain a worksheet.');

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '', raw: false });
  if (!rows.length) throw new Error('The worksheet is empty. Add a header row and teacher details first.');

  const headers = Object.keys(rows[0]);
  const findHeader = (aliases: string[]) => headers.find((header) => aliases.includes(normalizeHeader(header)));
  const fullNameHeader = findHeader(['fullname', 'teachername', 'name']);
  if (!fullNameHeader) {
    throw new Error('A name column is required. Use “Full Name” or “Teacher Name” as the column heading.');
  }

  const designationHeader = findHeader(['designation', 'academictitle', 'title', 'position']);
  const departmentHeader = findHeader(['department', 'faculty']);
  const messageHeader = findHeader(['personalizedmessage', 'message']);
  const teachers: TeacherFormData[] = [];
  const skippedRows: number[] = [];

  rows.forEach((row, index) => {
    const fullName = String(row[fullNameHeader] ?? '').trim();
    const hasData = Object.values(row).some((value) => String(value ?? '').trim() !== '');
    if (!hasData) return;
    if (!fullName) {
      skippedRows.push(index + 2);
      return;
    }

    teachers.push({
      full_name: fullName,
      designation: designationHeader ? String(row[designationHeader] ?? '').trim() : '',
      department: departmentHeader ? String(row[departmentHeader] ?? '').trim() : '',
      personalized_message: messageHeader ? String(row[messageHeader] ?? '').trim() : '',
    });
  });

  if (!teachers.length) throw new Error('No teacher rows with a name were found in the worksheet.');
  return { teachers, skippedRows };
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppBrandingProvider>
          <Routes>
            <Route path="/admin/login" element={<LoginPage />} />
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute>
                  <AdminShell />
                </ProtectedRoute>
              }
            />
            <Route path="/invite/:token" element={<InvitationPage />} />
            <Route path="/public/:token" element={<PublicInvitationPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </AppBrandingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function LoginPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/admin" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      navigate('/admin', { replace: true });
    } catch (loginError) {
      setError(messageFrom(loginError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <Brand />
        <span className="eyebrow">INVITATION CONSOLE</span>
        <h1>Welcome back</h1>
        <p>Sign in to manage your festival invitations.</p>
        <form onSubmit={handleSubmit} className="form-stack">
          <label>
            Email address
            <input autoComplete="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input autoComplete="current-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <Notice tone="error">{error}</Notice>}
          <button className="button button-primary button-wide" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
            <ArrowRight size={16} />
          </button>
        </form>
      </section>
    </main>
  );
}

function Brand() {
  const { logoUrl } = useAppBranding();
  return (
    <Link to="/admin" className="brand" aria-label="HDU Festival home">
      <span className="brand-mark">{logoUrl ? <img src={logoUrl} alt="" /> : 'H'}</span>
      <span>
        <strong>HDU Festival</strong>
        <small>INVITATION CONSOLE</small>
      </span>
    </Link>
  );
}

function AdminShell() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [invitationNavOpen, setInvitationNavOpen] = useState(
    location.pathname.startsWith('/admin/invitations') || location.pathname === '/admin/public-invitation-settings'
  );
  const [signingOut, setSigningOut] = useState(false);
  const title = location.pathname === '/admin/invitations/print'
    ? 'Print invitations'
    : location.pathname === '/admin/public-invitation-settings'
      ? 'Public invitation settings'
      : navigation.find((item) => item.to === location.pathname)?.label ?? 'Dashboard';
  const initials = (user?.email ?? 'A').slice(0, 1).toUpperCase();

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/admin/login', { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <Brand />
          <button className="icon-button mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <p className="sidebar-intro">Build invites, manage guests, and keep every event organized in one place.</p>
        <div className="nav-heading">WORKSPACE</div>
        <nav className="side-nav">
          {navigation.map(({ label, to, icon: Icon }) => (
            label === 'Invitations' ? (
              <div className="nav-group" key={to}>
                <div className={`nav-link ${location.pathname === to || location.pathname.startsWith(`${to}/`) || location.pathname === '/admin/public-invitation-settings' ? 'nav-link-active' : ''}`}>
                  <Link to={to} className="nav-link-main" onClick={() => setMenuOpen(false)}>
                    <Icon size={16} strokeWidth={1.8} />
                    {label}
                  </Link>
                  <button
                    className="nav-expand"
                    type="button"
                    aria-label={`${invitationNavOpen ? 'Collapse' : 'Expand'} invitation settings`}
                    aria-expanded={invitationNavOpen}
                    onClick={() => setInvitationNavOpen((open) => !open)}
                  >
                    <ChevronDown className={`nav-chevron ${invitationNavOpen ? 'nav-chevron-open' : ''}`} size={14} />
                  </button>
                </div>
                {invitationNavOpen && (
                  <>
                    <Link
                      to="/admin/public-invitation-settings"
                      className={`nav-link nav-sub-link ${location.pathname === '/admin/public-invitation-settings' ? 'nav-link-active' : ''}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      Public invitation settings
                    </Link>
                    <Link
                      to="/admin/invitations/print"
                      className={`nav-link nav-sub-link ${location.pathname === '/admin/invitations/print' ? 'nav-link-active' : ''}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      Print invitations
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={`nav-link ${location.pathname === to ? 'nav-link-active' : ''}`}
              >
                <Icon size={16} strokeWidth={1.8} />
                {label}
              </Link>
            )
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon"><CircleHelp size={17} /></span>
            <div><strong>Need a hand?</strong><small>Manage your event workspace</small></div>
            <ArrowRight size={15} />
          </div>
          <div className="sidebar-user">
            <span className="avatar">{initials}</span>
            <span className="user-copy"><strong>{user?.email?.split('@')[0] ?? 'Administrator'}</strong><small>Workspace admin</small></span>
            <button className="icon-button" title="Sign out" onClick={handleSignOut} disabled={signingOut}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      {menuOpen && <button className="mobile-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
      <div className="main-column">
        <header className="topbar">
          <button className="icon-button menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={19} /></button>
          <div className="crumb"><span>INVITATION CONSOLE</span><strong>{title}</strong></div>
          <div className="topbar-actions">
            <button className="icon-button topbar-help" title="Help"><CircleHelp size={18} /></button>
            <span className="avatar avatar-small">{initials}</span>
            <span className="topbar-user"><strong>{user?.email?.split('@')[0] ?? 'Administrator'}</strong><small>Workspace admin</small></span>
            <button className="icon-button" title="Notifications"><Bell size={17} /></button>
          </div>
        </header>
        <main className="page-content">
          <Routes>
            <Route index element={<DashboardPage />} />
            <Route path="invitations/print" element={<PrintInvitationsPage />} />
            <Route path="invitations" element={<InvitationsPage />} />
            <Route path="public-invitation-settings" element={<PublicInvitationSettingsPage />} />
            <Route path="teachers" element={<TeachersPage />} />
            <Route path="rsvps" element={<RSVPsPage />} />
            <Route path="event-settings" element={<EventSettingsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="page-heading">
      <div><h1>{title}</h1><p>{description}</p></div>
      {action}
    </div>
  );
}

function DashboardPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [activeInviteCount, setActiveInviteCount] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchEvents()
      .then((items) => {
        if (!active) return;
        setEvents(items);
        setEventId((current) => current || items[0]?.id || '');
      })
      .catch((cause) => active && setError(messageFrom(cause)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([fetchDashboardStats(eventId), fetchInvitations()])
      .then(([nextStats, allInvitations]) => {
        if (!active) return;
        setStats(nextStats);
        const eventInvitations = allInvitations.filter((item) => item.event_id === eventId);
        setActiveInviteCount(eventInvitations.filter((item) => item.invitation_status === 'active').length);
        setInvitations(eventInvitations.slice(0, 4));
      })
      .catch((cause) => active && setError(messageFrom(cause)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [eventId]);

  const responseRate = stats && stats.totalInvitations
    ? Math.round((stats.totalRSVPs / stats.totalInvitations) * 100)
    : 0;

  return (
    <>
      <PageHeading
        title="Dashboard"
        description="Track festival activity at a glance, then jump into your invitation workspace when you need to make changes."
        action={events.length > 1 ? <select className="event-select" value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Choose event">{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select> : undefined}
      />
      {error && <Notice tone="error">{error}</Notice>}
      {!loading && events.length === 0 && !error && <Notice tone="info">Create an event in Event settings before issuing invitations.</Notice>}
      <Link to="/admin/invitations" className="create-banner">
        <span className="create-icon"><Plus size={19} /></span>
        <span className="create-copy"><span className="eyebrow">CREATE INVITATION</span><strong>Create a new invitation</strong><small>Start with your event and guest details to prepare a personalized invite.</small></span>
        <ArrowRight className="create-arrow" size={19} />
      </Link>
      <section className="stats-grid" aria-label="Festival statistics">
        <StatCard label="TOTAL INVITATIONS" value={loading || !stats ? '—' : stats.totalInvitations} icon={<Ticket size={17} />} />
        <StatCard label="TEACHERS" value={loading || !stats ? '—' : stats.totalTeachers} icon={<Users size={17} />} />
        <StatCard label="RSVPS RECEIVED" value={loading || !stats ? '—' : stats.totalRSVPs} icon={<ClipboardCheck size={17} />} />
        <StatCard label="GUESTS EXPECTED" value={loading || !stats ? '—' : stats.totalGuests} icon={<CalendarDays size={17} />} />
      </section>
      <div className="dashboard-grid">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div><h2>Recent invitations</h2><p>A quick look at the invites you are most likely to jump back into.</p></div>
            <Link to="/admin/invitations" className="button button-quiet">View all</Link>
          </div>
          {loading ? <div className="empty-state">Loading invitations…</div> : error ? <div className="empty-state">Invitations could not be loaded.</div> : invitations.length ? (
            <div className="invitation-list">
              {invitations.map((invite) => (
                <div className="invitation-row" key={invite.id}>
                  <span className="row-icon"><Ticket size={16} /></span>
                  <span className="row-primary"><strong>{invite.teacher?.full_name ?? invite.event?.title ?? 'Festival invitation'}</strong><small>{invite.teacher?.department ?? invite.event?.title ?? 'Guest invitation'}</small></span>
                  <span className={`status-pill status-${invite.invitation_status}`}>{invite.invitation_status}</span>
                  <Link to="/admin/invitations" className="icon-button" aria-label="Open invitations"><ArrowRight size={16} /></Link>
                </div>
              ))}
            </div>
          ) : <div className="empty-state"><Ticket size={22} /><span>No invitations yet. Create your first one to get started.</span></div>}
        </section>
        <section className="panel response-panel">
          <h2>Response snapshot</h2>
          <p>See how your guests are responding.</p>
          <div className="snapshot-card">
            <span className="eyebrow">RESPONSE RATE</span>
            <strong>{loading || !stats ? '—' : `${responseRate}%`}</strong>
            <small>{stats ? `${stats.totalRSVPs} RSVP${stats.totalRSVPs === 1 ? '' : 's'} received from ${stats.totalInvitations} invitations.` : 'RSVP activity will appear here.'}</small>
            <div className="progress-track"><span style={{ width: `${Math.min(responseRate, 100)}%` }} /></div>
          </div>
          <div className="snapshot-card workspace-card">
            <span className="eyebrow">WORKSPACE STATUS</span>
            <strong>Admin access enabled</strong>
            <small>You can manage event details, teachers, and invitations from this workspace.</small>
          </div>
          {stats && !loading && <div className="snapshot-foot"><span className="live-dot" />{activeInviteCount} active invite{activeInviteCount === 1 ? '' : 's'} in this event</div>}
        </section>
      </div>
    </>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: ReactNode }) {
  return <article className="stat-card"><span className="eyebrow">{label}</span><div><strong>{value}</strong><span className="stat-icon">{icon}</span></div></article>;
}

function InvitationsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [eventId, setEventId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [createdLink, setCreatedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [actionBusyId, setActionBusyId] = useState('');
  const [editingInvite, setEditingInvite] = useState<Invitation | null>(null);
  const [letterDraft, setLetterDraft] = useState('');
  const [landingDraft, setLandingDraft] = useState<InvitationLandingPageConfig>(defaultLandingPageConfig);
  const [qrTheme, setQrTheme] = useState<QrLandingPageTheme>(defaultQrLandingPageTheme);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState('');
  const musicInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!backgroundFile) {
      setBackgroundPreviewUrl('');
      return;
    }

    const previewUrl = URL.createObjectURL(backgroundFile);
    setBackgroundPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [backgroundFile]);

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const [nextEvents, nextTeachers, nextInvitations, nextQrTheme] = await Promise.all([
        fetchEvents(),
        fetchTeachers(),
        fetchInvitations(),
        fetchQrLandingPageTheme(),
      ]);
      setEvents(nextEvents);
      setEventId((current) => current || nextEvents[0]?.id || '');
      setTeachers(nextTeachers);
      setInvitations(nextInvitations);
      setQrTheme(nextQrTheme);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void reload(); }, []);

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eventId || !teacherId) return;
    const alreadyInvited = invitations.some((invite) =>
      invite.event_id === eventId &&
      invite.guest_id === teacherId &&
      invite.invitation_status !== 'revoked'
    );
    if (alreadyInvited) {
      setError('This teacher already has an invitation for this event.');
      return;
    }

    setBusy(true);
    setError('');
    setBulkMessage('');
    setCreatedLink('');
    try {
      const result = await adminOps<{ success: boolean; shareable_token?: string }>('generate-token', { event_id: eventId, guest_id: teacherId });
      const shareableToken = result?.shareable_token;
      if (!result?.success || !shareableToken) throw new Error('The invitation was created without a shareable token.');
      setCreatedLink(`${window.location.origin}/invite/${shareableToken}`);
      await reload();
    } catch (cause) {
      const message = messageFrom(cause);
      setError(/duplicate|already exists|23505/i.test(message)
        ? 'This teacher already has an invitation for this event.'
        : message);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(createdLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function createBulkInvites() {
    if (!eventId || !eligibleTeachers.length) return;

    setBulkBusy(true);
    setError('');
    setBulkMessage('');
    setCreatedLink('');
    try {
      const result = await adminOps<{
        generated: number;
        failed: number;
        failures: Array<{ teacher_id: string; error: string }>;
      }>('bulk-generate', {
        event_id: eventId,
        teacher_ids: eligibleTeachers.map((teacher) => teacher.id),
      });

      await reload();
      if (result.failed) {
        setError(`${result.generated} invitations created successfully; ${result.failed} failed. ${result.failures.map((failure) => failure.error).join(' ')}`);
      } else {
        setBulkMessage(`${result.generated} invitations created successfully.`);
      }
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBulkBusy(false);
    }
  }

  function inviteLink(invite: Invitation): string {
    return `${window.location.origin}/invite/${invite.invitation_code}`;
  }

  async function saveQr(invite: Invitation) {
    try {
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(inviteLink(invite), { width: 600, margin: 2 });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `invitation-${invite.teacher?.full_name?.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || invite.id}.png`;
      link.click();
    } catch (cause) {
      setError(messageFrom(cause));
    }
  }

  async function resetInvitation(invite: Invitation) {
    setActionBusyId(invite.id);
    setError('');
    try {
      const result = await adminOps<{ success: boolean; shareable_token?: string }>('regenerate-token', { invitation_id: invite.id });
      if (!result?.success || !result.shareable_token) throw new Error('The invitation could not be reset.');
      await reload();
      setCreatedLink(`${window.location.origin}/invite/${result.shareable_token}`);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setActionBusyId('');
    }
  }

  async function toggleInvitationStatus(invite: Invitation) {
    const nextStatus = invite.invitation_status === 'active' ? 'revoked' : 'active';
    setActionBusyId(invite.id);
    setError('');
    try {
      const updated = await updateInvitation(invite.id, { invitation_status: nextStatus });
      setInvitations((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setActionBusyId('');
    }
  }

  async function deleteInvite(invite: Invitation) {
    if (!window.confirm(`Delete the invitation for ${invite.teacher?.full_name ?? 'this guest'}? Its RSVP will also be deleted.`)) return;
    setActionBusyId(invite.id);
    setError('');
    try {
      await deleteInvitation(invite.id);
      await reload();
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setActionBusyId('');
    }
  }

  function editInviteLetter(invite: Invitation) {
    const invitationConfig = {
      ...defaultLandingPageConfig,
      ...(invite.landing_page_config ?? {}),
    };
    const sharedThemeConfigured = landingPageFontKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(qrTheme.font_families, key) ||
      Object.prototype.hasOwnProperty.call(qrTheme.font_colors, key)
    );
    setEditingInvite(invite);
    setLetterDraft(invite.letter_content ?? '');
    setLandingDraft({
      ...invitationConfig,
      font_family: sharedThemeConfigured ? qrTheme.font_family : invitationConfig.font_family,
      font_families: sharedThemeConfigured
        ? { ...qrTheme.font_families }
        : { ...invitationConfig.font_families },
      font_colors: sharedThemeConfigured
        ? { ...qrTheme.font_colors }
        : { ...invitationConfig.font_colors },
    });
    setMusicFile(null);
    setBackgroundFile(null);
    setError('');
  }

  async function saveInviteLetter() {
    if (!editingInvite) return;
    setActionBusyId(editingInvite.id);
    setError('');
    try {
      const nextQrTheme: QrLandingPageTheme = {
        font_family: landingDraft.font_family,
        font_families: { ...landingDraft.font_families },
        font_colors: { ...landingDraft.font_colors },
      };
      landingPageFontKeys.forEach((key) => {
        nextQrTheme.font_families[key] ??= '';
        nextQrTheme.font_colors[key] ??= '';
      });

      const musicUrl = musicFile
        ? await uploadInvitationPageAsset(editingInvite.id, musicFile, 'music')
        : landingDraft.music_url;
      const pageBackgroundUrl = backgroundFile
        ? await uploadInvitationPageAsset(editingInvite.id, backgroundFile, 'background')
        : landingDraft.page_background_url;
      const design = await saveInvitationLetterDesign(editingInvite.id, {
        letter_content: letterDraft.trim() || null,
        landing_page_config: {
          ...landingDraft,
          music_url: musicUrl,
          page_background_url: pageBackgroundUrl,
        },
      });
      await saveQrLandingPageTheme(nextQrTheme);
      setQrTheme(nextQrTheme);
      setInvitations((current) => current.map((invite) =>
        invite.id === editingInvite.id ? { ...invite, ...design } : invite
      ));
      setEditingInvite(null);
      setMusicFile(null);
      setBackgroundFile(null);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setActionBusyId('');
    }
  }

  type LandingPageConfigTextKey = Exclude<
    keyof InvitationLandingPageConfig,
    'font_family' | 'font_families' | 'font_colors' | 'confetti_enabled' |
    'music_url' | 'page_background_url' | 'page_background_position' | 'page_background_overlay'
  >;
  const landingPageFields: Array<{
    key: LandingPageConfigTextKey;
    label: string;
    multiline?: boolean;
  }> = [
    { key: 'university_heading', label: 'University heading' },
    { key: 'festival_title', label: 'Festival title' },
    { key: 'tagline', label: 'Festival subtitle', multiline: true },
    { key: 'invitation_badge', label: 'Invitation badge' },
    { key: 'countdown_label', label: 'Countdown heading' },
    { key: 'venue_name', label: 'Venue name', multiline: true },
    { key: 'venue_detail', label: 'Venue hall / floor' },
    { key: 'address', label: 'Event address', multiline: true },
    { key: 'dress_code', label: 'Dress code', multiline: true },
    { key: 'organizer', label: 'Organizer / footer', multiline: true },
  ];
  const landingPageAdditionalFields: Array<{
    key: LandingPageConfigTextKey;
    label: string;
    multiline?: boolean;
  }> = [
    { key: 'subway_guide', label: 'Subway directions', multiline: true },
    { key: 'campus_gate', label: 'Campus gate address', multiline: true },
    { key: 'campus_gate_chinese', label: 'Campus gate address (Chinese)' },
    { key: 'amap_url', label: 'Amap map link' },
    { key: 'tencent_map_url', label: 'Tencent map link' },
    { key: 'wechat', label: 'WeChat contact' },
    { key: 'email', label: 'Contact email' },
  ];
  const landingPageStyleFields: Array<{ key: InvitationLandingPageFontKey; label: string }> = [
    ...landingPageFields.map(({ key, label }) => ({ key, label })),
    ...landingPageAdditionalFields.map(({ key, label }) => ({ key, label })),
    { key: 'letter_message', label: 'Letter message' },
    ...landingPageExtraFontFields,
  ];
  const invitedTeacherIds = new Set(invitations
    .filter((invite) => invite.event_id === eventId && invite.invitation_status !== 'revoked')
    .map((invite) => invite.guest_id));
  const eligibleTeachers = teachers.filter((teacher) => teacher.is_active && !invitedTeacherIds.has(teacher.id));

  return (
    <>
      <PageHeading title="Invitations" description="Create and track personalized invitations for festival guests." />
      {error && <Notice tone="error">{error}</Notice>}
      <section className="panel create-form-panel">
        <div className="panel-heading"><div><h2>Create an invitation</h2><p>Choose an event and teacher to generate a unique, shareable invite link.</p></div></div>
        <form className="inline-form" onSubmit={createInvite}>
          <label>Event<select required value={eventId} onChange={(e) => {
            setEventId(e.target.value);
            setBulkMessage('');
            setCreatedLink('');
          }}><option value="">Select an event</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
          <label>Teacher<select required value={teacherId} onChange={(e) => setTeacherId(e.target.value)}><option value="">Select a teacher</option>{teachers.filter((teacher) => teacher.is_active).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}</select></label>
          <button className="button button-primary" disabled={busy || loading || !events.length || !teachers.length}><Plus size={16} />{busy ? 'Creating…' : 'Create invite'}</button>
        </form>
        {createdLink && <div className="success-link"><Check size={17} /><span><strong>Invitation created</strong><small>{createdLink}</small></span><button className="button button-quiet" onClick={copyLink}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy link'}</button></div>}
        <div className="bulk-invitation-action">
          <div>
            <strong>Create invitations for all eligible teachers</strong>
            <small>{eventId ? `${eligibleTeachers.length} active teacher${eligibleTeachers.length === 1 ? '' : 's'} without an invitation for this event.` : 'Select an event first.'}</small>
          </div>
          <button className="button" type="button" disabled={bulkBusy || loading || !eventId || !eligibleTeachers.length} onClick={() => void createBulkInvites()}>
            <Users size={15} />{bulkBusy ? 'Creating…' : `Create ${eligibleTeachers.length} invitations`}
          </button>
        </div>
        {bulkMessage && <div className="success-link bulk-success-message"><Check size={17} /><span><strong>{bulkMessage}</strong></span></div>}
      </section>
      {editingInvite && (
        <section className="panel invitation-editor-panel">
          <div className="panel-heading">
            <div>
              <h2>Edit QR invitation</h2>
              <p>Edit the complete QR landing page shown to {editingInvite.teacher?.full_name ?? 'this guest'} after scanning.</p>
            </div>
            <button className="button" type="button" onClick={() => window.open(inviteLink(editingInvite), '_blank', 'noopener,noreferrer')}>Preview QR page</button>
          </div>
          <div className="form-stack">
            <label>
              Letter message
              <textarea
                rows={5}
                maxLength={2000}
                value={letterDraft}
                onChange={(event) => setLetterDraft(event.target.value)}
                placeholder={editingInvite.teacher?.personalized_message ?? 'Write the message shown when this QR code is opened.'}
              />
              <small className="field-help">Leave blank to use the teacher’s personalized message.</small>
            </label>
            <section className="landing-editor-section">
              <div>
                <h3>QR landing page details</h3>
                <p>Edit the invitation wording here. Detailed font and color options are available below.</p>
              </div>
              <div className="landing-editor-grid">
                <FontFamilyPicker
                  label="Default font family (all text)"
                  value={landingDraft.font_family}
                  onChange={(font_family) => setLandingDraft((current) => ({ ...current, font_family }))}
                />
                {landingPageFields.map(({ key, label, multiline }) => (
                  <div className={`landing-editor-field${multiline ? ' landing-editor-wide' : ''}`} key={key}>
                    <label>
                      {label}
                      {multiline
                        ? <textarea rows={2} value={landingDraft[key]} onChange={(event) => setLandingDraft((current) => ({ ...current, [key]: event.target.value }))} />
                        : <input type={key.endsWith('_url') ? 'url' : 'text'} value={landingDraft[key]} onChange={(event) => setLandingDraft((current) => ({ ...current, [key]: event.target.value }))} />}
                    </label>
                  </div>
                ))}
              </div>
              <details className="landing-editor-details">
                <summary>Additional directions and contact information</summary>
                <div className="landing-editor-grid">
                  {landingPageAdditionalFields.map(({ key, label, multiline }) => (
                    <div className={`landing-editor-field${multiline ? ' landing-editor-wide' : ''}`} key={key}>
                      <label>
                        {label}
                        {multiline
                          ? <textarea rows={2} value={landingDraft[key]} onChange={(event) => setLandingDraft((current) => ({ ...current, [key]: event.target.value }))} />
                          : <input type={key.endsWith('_url') ? 'url' : 'text'} value={landingDraft[key]} onChange={(event) => setLandingDraft((current) => ({ ...current, [key]: event.target.value }))} />}
                      </label>
                    </div>
                  ))}
                </div>
              </details>
              <details className="landing-editor-details">
                <summary>Fonts and colors for the QR page</summary>
                <p>Styles sync by text role across all QR invitations; wording stays individual. Fonts must be installed on the viewing device.</p>
                <datalist id="word-font-family-suggestions">
                  {wordFontFamilySuggestions.map((fontFamily) => <option key={fontFamily} value={fontFamily} />)}
                </datalist>
                <div className="landing-editor-grid">
                  {landingPageStyleFields.map(({ key, label }) => (
                    <FontFamilyPicker
                      key={key}
                      label={`${label} font`}
                      value={landingDraft.font_families[key] ?? ''}
                      color={landingDraft.font_colors[key] ?? ''}
                      onChange={(fontFamily) => setLandingDraft((current) => ({
                        ...current,
                        font_families: { ...current.font_families, [key]: fontFamily },
                      }))}
                      onColorChange={(color) => setLandingDraft((current) => ({
                        ...current,
                        font_colors: { ...current.font_colors, [key]: color },
                      }))}
                    />
                  ))}
                </div>
              </details>
              <details className="landing-editor-details">
                <summary>Background, animation, and music</summary>
                <label className="confetti-setting">
                  <input type="checkbox" checked={landingDraft.confetti_enabled} onChange={(event) => setLandingDraft((current) => ({ ...current, confetti_enabled: event.target.checked }))} />
                  Show animated festival confetti
                </label>
                <div className="page-background-editor">
                <div>
                  <span className="field-label">Invitation background or animation</span>
                  <p>Upload an image or export an animated Canva design as GIF, MP4, or WebM. Canva project files cannot be uploaded directly. The animation plays behind the QR invitation.</p>
                </div>
                <input
                  ref={backgroundInputRef}
                  className="visually-hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm"
                  onChange={(event) => setBackgroundFile(event.target.files?.[0] ?? null)}
                />
                <span className="upload-field">
                  <button className="button" type="button" onClick={() => backgroundInputRef.current?.click()}>
                    <Upload size={15} />Upload image or animation
                  </button>
                  <small>{backgroundFile ? `${backgroundFile.name} · Preview only until you save` : landingDraft.page_background_url ? 'Current background is saved' : 'PNG, JPG, WebP, GIF, MP4, or WebM · 50 MB max'}</small>
                </span>
                <div className="landing-background-controls">
                  <label>
                    Background position
                    <select
                      value={landingDraft.page_background_position}
                      onChange={(event) => setLandingDraft((current) => ({ ...current, page_background_position: event.target.value as InvitationLandingPageConfig['page_background_position'] }))}
                    >
                      <option value="center">Center</option>
                      <option value="top">Top</option>
                      <option value="bottom">Bottom</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </label>
                  <label>
                    Background overlay <span className="range-value">{landingDraft.page_background_overlay}%</span>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      step="5"
                      value={landingDraft.page_background_overlay}
                      onChange={(event) => setLandingDraft((current) => ({ ...current, page_background_overlay: Number(event.target.value) }))}
                    />
                    <small>Lower the overlay to show more of your image.</small>
                  </label>
                </div>
                {(backgroundPreviewUrl || landingDraft.page_background_url) && (
                  <div className="invitation-background-preview">
                    <div className="invitation-background-preview-stage">
                      {(backgroundFile?.type.startsWith('video/') || (!backgroundFile && isVideoAnimation(landingDraft.page_background_url)))
                        ? <video
                          src={backgroundPreviewUrl || landingDraft.page_background_url}
                          autoPlay
                          loop
                          controls
                          muted
                          playsInline
                          style={{ objectPosition: landingDraft.page_background_position }}
                        />
                        : <img
                          src={backgroundPreviewUrl || landingDraft.page_background_url}
                          alt="Invitation background preview"
                          style={{ objectPosition: landingDraft.page_background_position }}
                        />}
                      <div className="invitation-background-preview-overlay" style={{ opacity: landingDraft.page_background_overlay / 100 }} />
                      <div className="invitation-background-preview-caption">
                        <strong>{landingDraft.festival_title || 'Your invitation title'}</strong>
                        <small>QR invitation preview</small>
                      </div>
                    </div>
                    <button className="button button-quiet button-danger" type="button" onClick={() => {
                      setLandingDraft((current) => ({ ...current, page_background_url: '' }));
                      setBackgroundFile(null);
                      if (backgroundInputRef.current) backgroundInputRef.current.value = '';
                    }}>
                      Remove background
                    </button>
                  </div>
                )}
                </div>
                <div className="landing-asset-grid">
                  <div className="form-stack">
                    <span className="field-label">Background music</span>
                    <input ref={musicInputRef} className="visually-hidden" type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm" onChange={(event) => setMusicFile(event.target.files?.[0] ?? null)} />
                    <span className="upload-field">
                      <button className="button" type="button" onClick={() => musicInputRef.current?.click()}><Upload size={15} />Upload music</button>
                      <small>{musicFile?.name ?? (landingDraft.music_url ? 'Current music is saved' : 'MP3, WAV, OGG, or WebM · 20 MB max')}</small>
                    </span>
                    {landingDraft.music_url && <button className="button button-quiet button-danger asset-remove" type="button" onClick={() => { setLandingDraft((current) => ({ ...current, music_url: '' })); setMusicFile(null); }}>Remove music</button>}
                  </div>
                </div>
              </details>
            </section>
          </div>
          <div className="event-form-actions">
            <button className="button" type="button" disabled={actionBusyId === editingInvite.id} onClick={() => setEditingInvite(null)}>Cancel</button>
            <button className="button button-primary" type="button" disabled={actionBusyId === editingInvite.id} onClick={() => void saveInviteLetter()}>
              {actionBusyId === editingInvite.id ? 'Saving…' : 'Save QR page'}
            </button>
          </div>
        </section>
      )}
      {!editingInvite && (
        <section className="panel table-panel">
          <div className="panel-heading">
            <div><h2>All invitations</h2><p>Latest invitations across your events.</p></div>
            <span className="count-badge">{invitations.length}</span>
          </div>
          {loading ? <div className="empty-state">Loading invitations…</div> : error ? <div className="empty-state">Invitations could not be loaded.</div> : invitations.length ? (
            <div className="table-scroll"><table><thead><tr><th>GUEST</th><th>EVENT</th><th>STATUS</th><th>QR</th><th>ACTIONS</th><th>CREATED</th></tr></thead><tbody>
              {invitations.map((invite) => (
                <tr key={invite.id}>
                  <td><strong>{invite.teacher?.full_name ?? 'Festival guest'}</strong><small>{invite.teacher?.department ?? 'Personal invitation'}</small></td>
                  <td>{invite.event?.title ?? '—'}</td>
                  <td>
                    <div className="invitation-status-cell">
                      <span className={`status-pill status-${invite.invitation_status}`}>{invite.invitation_status === 'active' ? 'Active' : invite.invitation_status === 'expired' ? 'Expired' : 'Inactive'}</span>
                      <button
                        className={`invitation-switch ${invite.invitation_status === 'active' ? 'is-on' : ''}`}
                        type="button"
                        role="switch"
                        aria-checked={invite.invitation_status === 'active'}
                        aria-label={`${invite.invitation_status === 'active' ? 'Deactivate' : 'Activate'} invitation for ${invite.teacher?.full_name ?? 'this guest'}`}
                        title={invite.invitation_status === 'active' ? 'Deactivate invitation' : 'Activate invitation'}
                        disabled={actionBusyId === invite.id}
                        onClick={() => void toggleInvitationStatus(invite)}
                      >
                        <span />
                      </button>
                    </div>
                  </td>
                  <td><button className="button button-quiet" type="button" onClick={() => void saveQr(invite)}><QrCode size={13} />Save QR</button></td>
                  <td><div className="table-actions">
                    <button className="button button-quiet" type="button" disabled={actionBusyId === invite.id} onClick={() => editInviteLetter(invite)}><Pencil size={12} />Edit QR page</button>
                    <button className="button button-quiet" type="button" disabled={actionBusyId === invite.id} onClick={() => void resetInvitation(invite)}>Reset QR</button>
                    <button className="button button-quiet button-danger" type="button" disabled={actionBusyId === invite.id} onClick={() => void deleteInvite(invite)}><Trash2 size={12} />Delete</button>
                  </div></td>
                  <td>{new Date(invite.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody></table></div>
          ) : <div className="empty-state"><Ticket size={22} /><span>There are no invitations yet.</span></div>}
        </section>
      )}
    </>
  );
}

function PrintInvitationsPage() {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchInvitations()
      .then((items) => {
        if (active) setInvitations(items);
      })
      .catch((cause) => {
        if (active) setError(messageFrom(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  function returnToInvitations() {
    navigate('/admin/invitations');
  }

  return (
    <>
      <PageHeading
        title="Print invitations"
        description="Customize and print active guest invitations."
        action={<button className="button" type="button" onClick={returnToInvitations}>Back to invitations</button>}
      />
      {error && <Notice tone="error">{error}</Notice>}
      {loading
        ? <div className="panel empty-state">Loading invitations…</div>
        : !error && <InvitationPrintSettingsEditor invitations={invitations} onClose={returnToInvitations} />}
    </>
  );
}

function PublicInvitationSettingsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState('');
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [qrImage, setQrImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsLoadFailed, setSettingsLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchEvents()
      .then((items) => {
        setEvents(items);
        setEventId(items[0]?.id ?? '');
      })
      .catch((cause) => setError(messageFrom(cause)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    setSettingsLoading(true);
    setSettingsLoadFailed(false);
    setSettings(null);
    setError('');
    setMessage('');
    fetchPublicSettings(eventId)
      .then((result) => {
        if (!active) return;
        setSettings(result);
        setWelcomeMessage(result?.welcome_message ?? '');
        setIsActive(result?.is_active ?? true);
      })
      .catch((cause) => {
        if (!active) return;
        setSettingsLoadFailed(true);
        setError(messageFrom(cause));
      })
      .finally(() => active && setSettingsLoading(false));
    return () => { active = false; };
  }, [eventId]);

  useEffect(() => {
    if (!settings) {
      setQrImage('');
      return;
    }

    let active = true;
    const publicLink = `${window.location.origin}/public/${settings.public_token}`;
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(publicLink, { width: 360, margin: 2 }))
      .then((image) => active && setQrImage(image))
      .catch((cause) => active && setError(messageFrom(cause)));
    return () => { active = false; };
  }, [settings?.public_token]);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eventId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updates = { welcome_message: welcomeMessage.trim() || null, is_active: isActive };
      const saved = settings
        ? await updatePublicSettings(settings.id, updates)
        : await createPublicSettings(eventId, updates);
      setSettings(saved);
      setWelcomeMessage(saved.welcome_message ?? '');
      setIsActive(saved.is_active);
      setMessage('Public invitation settings saved.');
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setSaving(false);
    }
  }

  async function copyPublicLink() {
    if (!settings) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/public/${settings.public_token}`);
      setMessage('Public invitation link copied.');
      setError('');
    } catch (cause) {
      setError(messageFrom(cause));
    }
  }

  function downloadPublicQr() {
    if (!qrImage) return;
    const eventName = events.find((item) => item.id === eventId)?.title ?? 'invitation';
    const link = document.createElement('a');
    link.href = qrImage;
    link.download = `public-invitation-${eventName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
    link.click();
  }

  return (
    <>
      <PageHeading
        title="Public invitation settings"
        description="Configure the public invitation link and welcome message for an event."
      />
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="info">{message}</Notice>}
      {loading ? <div className="panel empty-state">Loading events…</div> : !events.length ? (
        <div className="panel empty-state"><CalendarDays size={22} /><span>Create an event before setting up a public invitation.</span></div>
      ) : (
        <section className="panel event-form-panel">
          <form className="form-stack" onSubmit={(event) => void saveSettings(event)}>
            <label>
              Event
              <select value={eventId} onChange={(event) => setEventId(event.target.value)} disabled={saving}>
                {events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            {settingsLoading ? <div className="empty-state">Loading public invitation settings…</div> : (
              <>
                <label>
                  Welcome message
                  <textarea rows={4} maxLength={2000} value={welcomeMessage} onChange={(event) => setWelcomeMessage(event.target.value)} placeholder="Welcome to the event. We are delighted to have you join us." />
                </label>
                <label className="settings-toggle">
                  <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
                  Enable public invitation
                </label>
                {settings && (
                  <div className="public-share-grid">
                    <div className="public-invitation-link">
                      <div><strong>Public invitation link</strong><small>{window.location.origin}/public/{settings.public_token}</small></div>
                      <button className="button" type="button" onClick={() => void copyPublicLink()}><Copy size={14} />Copy link</button>
                    </div>
                    <section className="public-qr-panel">
                      <strong>Public QR code</strong>
                      {qrImage ? <img src={qrImage} alt="QR code for the public invitation" /> : <small>Preparing QR code…</small>}
                      <small>Share this QR code so guests can open the invitation.</small>
                      <button className="button" type="button" disabled={!qrImage} onClick={downloadPublicQr}><Download size={14} />Download QR</button>
                    </section>
                  </div>
                )}
                <div className="event-form-actions">
                  <button className="button button-primary" type="submit" disabled={saving || settingsLoading || settingsLoadFailed}>
                    {saving ? 'Saving…' : settings ? 'Save settings' : 'Create public invitation'}
                  </button>
                </div>
              </>
            )}
          </form>
        </section>
      )}
    </>
  );
}

interface PrintableInvitationDesign {
  brandText: string;
  brandColor: string;
  fontFamily: string;
  fontFamilies: Partial<Record<PrintableInvitationFontKey, string>>;
  showLogo: boolean;
  heading: string;
  message: string;
  closing: string;
  footer: string;
  accentColor: string;
  backgroundImage: string;
  textAlignment: 'left' | 'center' | 'right';
  verticalAlignment: 'top' | 'center' | 'bottom';
  backgroundPosition: 'center' | 'top' | 'bottom' | 'left' | 'right';
  backgroundOverlay: number;
}

type PrintableInvitationFontKey =
  | 'brandText'
  | 'heading'
  | 'eventTitle'
  | 'recipient'
  | 'message'
  | 'personalMessage'
  | 'date'
  | 'venue'
  | 'closing'
  | 'footer';

const printableInvitationFontFields: Array<{ key: PrintableInvitationFontKey; label: string }> = [
  { key: 'brandText', label: 'Brand text' },
  { key: 'heading', label: 'Invitation heading' },
  { key: 'eventTitle', label: 'Event title' },
  { key: 'recipient', label: 'Guest name' },
  { key: 'message', label: 'Invitation message' },
  { key: 'personalMessage', label: 'Personal message' },
  { key: 'date', label: 'Date' },
  { key: 'venue', label: 'Venue' },
  { key: 'closing', label: 'Closing message' },
  { key: 'footer', label: 'Footer' },
];

const printableAccentColors = [
  { name: 'Festival rose', value: '#cb5464' },
  { name: 'Festival red', value: '#f42a41' },
  { name: 'Terracotta', value: '#c7664d' },
  { name: 'Bronze', value: '#9a6849' },
  { name: 'Festival gold', value: '#d4af37' },
  { name: 'Lime', value: '#cdd34f' },
  { name: 'Forest green', value: '#006a4e' },
  { name: 'Sage', value: '#5f9275' },
  { name: 'Teal', value: '#18a3a5' },
  { name: 'Sky blue', value: '#3286c8' },
  { name: 'Navy', value: '#303f9f' },
  { name: 'Violet', value: '#8056ad' },
  { name: 'Orchid', value: '#bc5b9e' },
  { name: 'Charcoal', value: '#3d4147' },
];

const printDesignStorageKey = 'hdu-print-invitation-design-v1';
const defaultPrintableInvitationDesign: PrintableInvitationDesign = {
  brandText: 'HDU CULTURAL FESTIVAL',
  brandColor: '#92877d',
  fontFamily: '',
  fontFamilies: {},
  showLogo: true,
  heading: 'You Are Invited',
  message: 'We are delighted to invite you to join us for this special celebration. Your presence would make this event even more memorable. Please scan the QR code to view your invitation and RSVP.',
  closing: 'We look forward to welcoming you.',
  footer: 'HDU Cultural Festival · Hangzhou Dianzi University',
  accentColor: '#9a6849',
  backgroundImage: '',
  textAlignment: 'left',
  verticalAlignment: 'center',
  backgroundPosition: 'center',
  backgroundOverlay: 58,
};

function InvitationPrintSettingsEditor({
  invitations,
  onClose,
}: {
  invitations: Invitation[];
  onClose: () => void;
}) {
  const { logoUrl } = useAppBranding();
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [storageReady, setStorageReady] = useState(false);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [design, setDesign] = useState<PrintableInvitationDesign>(defaultPrintableInvitationDesign);
  const [accentPaletteOpen, setAccentPaletteOpen] = useState(false);

  useEffect(() => {
    try {
      const savedDesign = window.localStorage.getItem(printDesignStorageKey);
      if (savedDesign) {
        const parsedDesign = JSON.parse(savedDesign) as Partial<PrintableInvitationDesign> & { description?: string };
        delete parsedDesign.description;
        setDesign({ ...defaultPrintableInvitationDesign, ...parsedDesign });
      }
    } catch (cause) {
      setStorageError(`Saved print settings could not be loaded: ${messageFrom(cause)}`);
    } finally {
      setStorageReady(true);
    }

  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(printDesignStorageKey, JSON.stringify(design));
    } catch (cause) {
      setStorageError(`Print settings could not be saved in this browser: ${messageFrom(cause)}`);
    }
  }, [design, storageReady]);

  useEffect(() => {
    const activeInvitations = invitations.filter((invite) => invite.invitation_status === 'active');
    if (!activeInvitations.length) {
      setQrImages({});
      setQrLoading(false);
      return;
    }

    let cancelled = false;
    setQrLoading(true);
    import('qrcode')
      .then(({ default: QRCode }) => Promise.all(activeInvitations.map(async (invite) => {
        const url = `${window.location.origin}/invite/${invite.invitation_code}`;
        return [invite.id, await QRCode.toDataURL(url, { width: 360, margin: 2 })] as const;
      })))
      .then((entries) => {
        if (!cancelled) setQrImages(Object.fromEntries(entries));
      })
      .catch((cause) => {
        if (!cancelled) setError(messageFrom(cause));
      })
      .finally(() => {
        if (!cancelled) setQrLoading(false);
      });

    return () => { cancelled = true; };
  }, [invitations]);

  const activeInvitations = invitations.filter((invite) => invite.invitation_status === 'active');
  const allQrCodesReady = activeInvitations.length > 0 && activeInvitations.every((invite) => qrImages[invite.id]);

  function updateDesign<Field extends keyof PrintableInvitationDesign>(
    field: Field,
    value: PrintableInvitationDesign[Field],
  ) {
    setDesign((current) => ({ ...current, [field]: value }));
  }

  function updatePrintFont(field: PrintableInvitationFontKey, value: string) {
    setDesign((current) => ({
      ...current,
      fontFamilies: { ...current.fontFamilies, [field]: value },
    }));
  }

  function uploadBackground(file: File | undefined) {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file for the invitation background.');
      return;
    }
    if (file.size > 1_000_000) {
      setError('The invitation background must be 1 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setError('The invitation background could not be read.');
        return;
      }
      updateDesign('backgroundImage', reader.result);
    };
    reader.onerror = () => setError(reader.error?.message ?? 'The invitation background could not be read.');
    reader.readAsDataURL(file);
  }

  function renderInvitation(invite: Invitation) {
    const teacherName = invite.teacher?.full_name ?? invite.guest?.full_name ?? 'Festival guest';
    const personalMessage = invite.letter_content || invite.teacher?.personalized_message;
    const printFontStyle = (key: PrintableInvitationFontKey) => ({
      fontFamily: fontFamilyValue(design.fontFamilies[key] || design.fontFamily) || undefined,
    });

    return (
      <article
        className={`print-invitation-card${design.fontFamily.trim() ? ' print-custom-font' : ''}`}
        key={invite.id}
        style={{
          fontFamily: fontFamilyValue(design.fontFamily) || undefined,
          alignItems: design.verticalAlignment === 'top' ? 'flex-start' : design.verticalAlignment === 'bottom' ? 'flex-end' : 'center',
          borderColor: design.accentColor,
          backgroundImage: design.backgroundImage
            ? `linear-gradient(rgb(255 253 250 / ${design.backgroundOverlay}%), rgb(255 253 250 / ${design.backgroundOverlay}%)), url("${design.backgroundImage}")`
            : undefined,
          backgroundPosition: design.backgroundPosition,
        }}
      >
        <div className="print-invitation-content" style={{ textAlign: design.textAlignment }}>
          <div
            className="print-invitation-brand"
            style={{ justifyContent: design.textAlignment === 'center' ? 'center' : design.textAlignment === 'right' ? 'flex-end' : 'flex-start' }}
          >
            {design.showLogo && (logoUrl
              ? <img className="print-invitation-logo" src={logoUrl} alt="HDU Festival logo" />
              : <span className="print-invitation-logo-placeholder">HDU</span>)}
            <span className="eyebrow" style={{ ...printFontStyle('brandText'), color: design.brandColor }}>{design.brandText}</span>
          </div>
          <h2 style={{ ...printFontStyle('heading'), color: design.accentColor }}>{design.heading}</h2>
          <h3 style={printFontStyle('eventTitle')}>{invite.event?.title ?? 'Festival invitation'}</h3>
          <p className="print-invitation-name" style={printFontStyle('recipient')}>Dear {teacherName},</p>
          <p style={printFontStyle('message')}>{design.message}</p>
          {personalMessage && <p style={printFontStyle('personalMessage')}>{personalMessage}</p>}
          {invite.event?.event_date && <p style={printFontStyle('date')}><strong>Date:</strong> {new Date(invite.event.event_date).toLocaleString()}</p>}
          {invite.event?.venue && <p style={printFontStyle('venue')}><strong>Venue:</strong> {invite.event.venue}</p>}
          <p style={printFontStyle('closing')}>{design.closing}</p>
          <small style={printFontStyle('footer')}>{design.footer}</small>
        </div>
        {qrImages[invite.id]
          ? <img className="print-invitation-qr" src={qrImages[invite.id]} alt={`Unique invitation QR code for ${teacherName}`} />
          : <span className="print-invitation-qr-placeholder">QR code</span>}
      </article>
    );
  }

  return (
    <>
      {error && <Notice tone="error">{error}</Notice>}
      {storageError && <Notice tone="error">{storageError}</Notice>}
      {!activeInvitations.length ? <div className="panel empty-state"><Ticket size={22} /><span>There are no active invitations to print.</span></div> : (
        <>
          <div className="print-layout print-settings-inline">
            <section className="panel print-settings-panel">
              <div className="panel-heading">
                <div><h2>Invitation design</h2><p>Changes are saved in this browser for future print sessions.</p></div>
                <span className="count-badge">{activeInvitations.length}</span>
              </div>
              <div className="print-design-fields">
                <div className="print-design-field">
                  <label>Festival name or brand text<input value={design.brandText} maxLength={100} onChange={(event) => updateDesign('brandText', event.target.value)} /></label>
                  <label className="print-brand-color">
                    Brand text color
                    <input type="color" value={design.brandColor} onChange={(event) => updateDesign('brandColor', event.target.value)} />
                  </label>
                </div>
                <label className="print-logo-toggle">
                  <input type="checkbox" checked={design.showLogo} onChange={(event) => updateDesign('showLogo', event.target.checked)} />
                  <span>Show logo</span>
                </label>
                <label>Invitation heading<input value={design.heading} maxLength={100} onChange={(event) => updateDesign('heading', event.target.value)} /></label>
                <label>Invitation message<textarea rows={5} maxLength={2000} value={design.message} onChange={(event) => updateDesign('message', event.target.value)} /></label>
                <label>Closing message<input value={design.closing} maxLength={300} onChange={(event) => updateDesign('closing', event.target.value)} /></label>
                <label>Footer<input value={design.footer} maxLength={200} onChange={(event) => updateDesign('footer', event.target.value)} /></label>
                <details className="print-settings-group">
                  <summary>Font families</summary>
                  <FontFamilyPicker
                    label="Default font family (all text)"
                    value={design.fontFamily}
                    onChange={(fontFamily) => updateDesign('fontFamily', fontFamily)}
                  />
                  <datalist id="word-font-family-suggestions">
                    {wordFontFamilySuggestions.map((fontFamily) => <option key={fontFamily} value={fontFamily} />)}
                  </datalist>
                  <div className="print-font-grid">
                    {printableInvitationFontFields.map(({ key, label }) => (
                      <FontFamilyPicker
                        key={key}
                        label={`${label} font`}
                        value={design.fontFamilies[key] ?? ''}
                        onChange={(value) => updatePrintFont(key, value)}
                      />
                    ))}
                  </div>
                </details>
                <details className="print-settings-group">
                  <summary>Colors, layout, and background</summary>
                  <div className="print-color-field">
                    <span>Accent color</span>
                    <button
                      className="print-color-trigger"
                      type="button"
                      aria-label="Open accent color palette"
                      aria-expanded={accentPaletteOpen}
                      aria-controls="print-accent-color-palette"
                      onClick={() => setAccentPaletteOpen((open) => !open)}
                    >
                      <span style={{ backgroundColor: design.accentColor }} />
                      <Pencil size={14} />
                    </button>
                    {accentPaletteOpen && (
                      <div className="print-color-palette" id="print-accent-color-palette" role="group" aria-label="Choose an accent color">
                        <div className="print-color-swatches">
                          {printableAccentColors.map((color) => (
                            <button
                              key={color.value}
                              className="print-color-swatch"
                              type="button"
                              aria-label={color.name}
                              aria-pressed={design.accentColor.toLowerCase() === color.value}
                              title={color.name}
                              style={{ backgroundColor: color.value }}
                              onClick={() => {
                                updateDesign('accentColor', color.value);
                                setAccentPaletteOpen(false);
                              }}
                            />
                          ))}
                        </div>
                        <label className="print-custom-color">
                          Custom color
                          <input type="color" value={design.accentColor} onChange={(event) => updateDesign('accentColor', event.target.value)} />
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="print-layout-controls">
                    <label>
                      Text alignment
                      <select value={design.textAlignment} onChange={(event) => updateDesign('textAlignment', event.target.value as PrintableInvitationDesign['textAlignment'])}>
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                    <label>
                      Vertical position
                      <select value={design.verticalAlignment} onChange={(event) => updateDesign('verticalAlignment', event.target.value as PrintableInvitationDesign['verticalAlignment'])}>
                        <option value="top">Top</option>
                        <option value="center">Center</option>
                        <option value="bottom">Bottom</option>
                      </select>
                    </label>
                    <label>
                      Background crop
                      <select value={design.backgroundPosition} onChange={(event) => updateDesign('backgroundPosition', event.target.value as PrintableInvitationDesign['backgroundPosition'])}>
                        <option value="center">Center</option>
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Background overlay <span className="range-value">{design.backgroundOverlay}%</span>
                    <input type="range" min="0" max="85" step="5" value={design.backgroundOverlay} onChange={(event) => updateDesign('backgroundOverlay', Number(event.target.value))} />
                    <small>Lower the overlay to show more of your uploaded design.</small>
                  </label>
                  <label>Upload background design<input type="file" accept="image/*" onChange={(event) => uploadBackground(event.target.files?.[0])} /><small>Image files up to 1 MB. The QR code stays fixed in the bottom-right corner.</small></label>
                  {design.backgroundImage && <button className="button button-quiet button-danger print-remove-background" type="button" onClick={() => updateDesign('backgroundImage', '')}>Remove background design</button>}
                </details>
              </div>
              {qrLoading && <p className="print-status">Preparing unique QR codes…</p>}
              <div className="print-settings-actions">
                <button className="button" type="button" onClick={onClose}>Close</button>
                <button className="button button-primary" type="button" disabled={!allQrCodesReady || qrLoading} onClick={() => window.print()}><Printer size={15} />Print invitations ({activeInvitations.length})</button>
              </div>
            </section>
            <section className="print-preview-area">
              <div className="print-preview-heading"><h2>Print preview</h2><span>{activeInvitations.length} personalized invitation(s)</span></div>
              {activeInvitations[0] && <div className="print-preview-card">{renderInvitation(activeInvitations[0])}</div>}
            </section>
          </div>
          <div className="print-invitation-list">{activeInvitations.map(renderInvitation)}</div>
        </>
      )}
    </>
  );
}

function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [teacherForm, setTeacherForm] = useState<TeacherFormData>({
    full_name: '',
    designation: '',
    department: '',
    personalized_message: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    Promise.all([fetchTeachers(), fetchInvitations()])
      .then(([teacherItems, invitationItems]) => {
        setTeachers(teacherItems);
        setInvitations(invitationItems);
      })
      .catch((cause) => setError(messageFrom(cause)))
      .finally(() => setLoading(false));
  }, []);
  const activeTeachers = teachers.filter((teacher) => teacher.is_active);

  function startAddTeacher() {
    setTeacherForm({ full_name: '', designation: '', department: '', personalized_message: '' });
    setEditingTeacherId(null);
    setFormOpen(true);
    setError('');
    setImportMessage('');
  }

  function startEditTeacher(teacher: Teacher) {
    setTeacherForm({
      full_name: teacher.full_name,
      designation: teacher.designation ?? '',
      department: teacher.department ?? '',
      personalized_message: teacher.personalized_message ?? '',
    });
    setEditingTeacherId(teacher.id);
    setFormOpen(true);
    setError('');
    setImportMessage('');
  }

  async function saveTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submission = {
      ...teacherForm,
      full_name: teacherForm.full_name.trim(),
      designation: teacherForm.designation.trim(),
      department: teacherForm.department.trim(),
      personalized_message: teacherForm.personalized_message.trim(),
    };
    if (!submission.full_name) {
      setError('Enter the teacher’s full name.');
      return;
    }

    const teacherKey = (teacher: Pick<TeacherFormData, 'full_name' | 'designation' | 'department' | 'personalized_message'>) =>
      [teacher.full_name, teacher.designation, teacher.department, teacher.personalized_message]
        .map((value) => value.trim().toLowerCase()).join('\u001f');
    const duplicate = activeTeachers.find((teacher) =>
      teacher.id !== editingTeacherId &&
      teacherKey({
        full_name: teacher.full_name,
        designation: teacher.designation ?? '',
        department: teacher.department ?? '',
        personalized_message: teacher.personalized_message ?? '',
      }) === teacherKey(submission)
    );
    if (duplicate) {
      setError('A teacher with the same name and details already exists.');
      return;
    }

    setSavingTeacher(true);
    setError('');
    setImportMessage('');
    try {
      if (editingTeacherId) {
        const updated = await updateTeacher(editingTeacherId, submission);
        setTeachers((current) => current.map((teacher) => teacher.id === updated.id ? updated : teacher)
          .sort((a, b) => a.full_name.localeCompare(b.full_name)));
        setImportMessage('Teacher information updated.');
      } else {
        const created = await createTeacher(submission);
        setTeachers((current) => [...current, created].sort((a, b) => a.full_name.localeCompare(b.full_name)));
        setImportMessage('Teacher added successfully.');
      }
      setFormOpen(false);
      setEditingTeacherId(null);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setSavingTeacher(false);
    }
  }

  async function removeTeacher(teacher: Teacher) {
    if (!window.confirm(`Delete ${teacher.full_name}? Their invitations and RSVP records will also be permanently deleted.`)) return;
    setError('');
    setImportMessage('');
    try {
      await deleteTeacher(teacher.id);
      setTeachers((current) => current.map((item) => item.id === teacher.id ? { ...item, is_active: false } : item));
      setImportMessage(`${teacher.full_name}, their invitations, and RSVP records were deleted.`);
    } catch (cause) {
      setError(messageFrom(cause));
    }
  }

  async function importWorkbook(file: File) {
    setImporting(true);
    setError('');
    setImportMessage('');
    try {
      const { teachers: importedTeachers, skippedRows } = await parseTeacherWorkbook(file);
      const existingKeys = new Set(activeTeachers.map((teacher) => [
        teacher.full_name,
        teacher.designation ?? '',
        teacher.department ?? '',
        teacher.personalized_message ?? '',
      ].map((value) => value.trim().toLowerCase()).join('\u001f')));
      const newTeachers: TeacherFormData[] = [];
      let duplicateCount = 0;
      for (const teacher of importedTeachers) {
        const key = [
          teacher.full_name,
          teacher.designation,
          teacher.department,
          teacher.personalized_message,
        ].map((value) => value.trim().toLowerCase()).join('\u001f');
        if (existingKeys.has(key)) {
          duplicateCount += 1;
        } else {
          existingKeys.add(key);
          newTeachers.push(teacher);
        }
      }
      const createdTeachers = await createTeachers(newTeachers);
      setTeachers((current) => [...current, ...createdTeachers].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      const skippedMessage = skippedRows.length
        ? ` Skipped ${skippedRows.length} row(s) without a name${skippedRows.length <= 8 ? ` (rows ${skippedRows.join(', ')}).` : '.'}`
        : '';
      const duplicateMessage = duplicateCount ? ` Skipped ${duplicateCount} duplicate row(s) that already exist on the server.` : '';
      setImportMessage(`Imported ${createdTeachers.length} teacher(s).${skippedMessage}${duplicateMessage}`);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function exportWorkbook() {
    setError('');
    try {
      const XLSX = await import('xlsx');
      const rows = activeTeachers.map((teacher) => ({
        'Full Name': teacher.full_name,
        Designation: teacher.designation ?? '',
        Department: teacher.department ?? '',
        'Personalized Message': teacher.personalized_message ?? '',
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows, {
        header: ['Full Name', 'Designation', 'Department', 'Personalized Message'],
      });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Teachers');
      XLSX.writeFile(workbook, 'teachers.xlsx');
    } catch (cause) {
      setError(messageFrom(cause));
    }
  }

  return (
    <>
      <PageHeading
        title="Teachers"
        description="Manage the people receiving personalized festival invitations."
        action={
          !formOpen && (
            <div className="teacher-actions">
              <button className="button button-primary" type="button" disabled={loading || savingTeacher} onClick={startAddTeacher}>
                <Plus size={15} />Add teacher
              </button>
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept=".xlsx,.xls"
                aria-label="Upload teacher Excel file"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) void importWorkbook(file); }}
              />
              <button className="button" type="button" disabled={importing || loading} onClick={() => fileInputRef.current?.click()}>
                <Upload size={15} />{importing ? 'Importing…' : 'Upload Excel'}
              </button>
              <button className="button button-primary" type="button" disabled={loading} onClick={() => void exportWorkbook()}>
                <Download size={15} />Export Excel
              </button>
            </div>
          )
        }
      />
      {error && <Notice tone="error">{error}</Notice>}
      {importMessage && <Notice tone="info">{importMessage}</Notice>}
      {formOpen && (
        <section className="panel teacher-form-panel">
          <div className="panel-heading">
            <div>
              <h2>{editingTeacherId ? 'Edit teacher information' : 'Add a teacher'}</h2>
              <p>Enter the teacher’s details and the message shown on their personalized invitation.</p>
            </div>
          </div>
          <form className="form-stack" onSubmit={(event) => void saveTeacher(event)}>
            <div className="teacher-form-grid">
              <label>
                Full name
                <input required maxLength={150} value={teacherForm.full_name} onChange={(event) => setTeacherForm((current) => ({ ...current, full_name: event.target.value }))} />
              </label>
              <label>
                Designation
                <input maxLength={150} value={teacherForm.designation} onChange={(event) => setTeacherForm((current) => ({ ...current, designation: event.target.value }))} />
              </label>
              <label>
                Department
                <input maxLength={200} value={teacherForm.department} onChange={(event) => setTeacherForm((current) => ({ ...current, department: event.target.value }))} />
              </label>
              <label className="teacher-message-field">
                Personalized message
                <textarea rows={4} maxLength={2000} value={teacherForm.personalized_message} onChange={(event) => setTeacherForm((current) => ({ ...current, personalized_message: event.target.value }))} />
              </label>
            </div>
            <div className="event-form-actions">
              <button className="button" type="button" disabled={savingTeacher} onClick={() => { setFormOpen(false); setEditingTeacherId(null); }}>Cancel</button>
              <button className="button button-primary" type="submit" disabled={savingTeacher}>
                {savingTeacher ? 'Saving…' : editingTeacherId ? 'Save changes' : 'Add teacher'}
              </button>
            </div>
          </form>
        </section>
      )}
      <p className="teacher-import-help">Excel columns: Full Name (required), Designation, Department, Personalized Message.</p>
      <section className="panel table-panel">
        <div className="panel-heading"><div><h2>Teacher directory</h2><p>{activeTeachers.length} teachers in your workspace.</p></div><span className="count-badge">{activeTeachers.length}</span></div>
        {loading ? <div className="empty-state">Loading teachers…</div> : error && !activeTeachers.length ? <div className="empty-state">Teachers could not be loaded.</div> : activeTeachers.length ? (
          <div className="table-scroll"><table><thead><tr><th>NAME</th><th>DESIGNATION</th><th>DEPARTMENT</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>
            {activeTeachers.map((teacher) => {
              const teacherInvitations = invitations.filter((invite) => invite.guest_id === teacher.id);
              const hasActiveInvitation = teacherInvitations.some((invite) => invite.invitation_status === 'active');
              const isActive = teacher.is_active && (teacherInvitations.length === 0 || hasActiveInvitation);

              return (
                <tr key={teacher.id}>
                  <td><strong>{teacher.full_name}</strong><small>{teacher.personalized_message || 'No personalized message'}</small></td>
                  <td>{teacher.designation ?? '—'}</td>
                  <td>{teacher.department ?? '—'}</td>
                  <td><span className={`status-pill ${isActive ? 'status-active' : 'status-revoked'}`}>{isActive ? 'Active' : 'Inactive'}</span></td>
                  <td><div className="table-actions">
                    <button className="button button-quiet" type="button" disabled={savingTeacher} onClick={() => startEditTeacher(teacher)}><Pencil size={12} />Edit</button>
                    {teacher.is_active && <button className="button button-quiet button-danger" type="button" onClick={() => void removeTeacher(teacher)}><Trash2 size={12} />Delete</button>}
                  </div></td>
                </tr>
              );
            })}
          </tbody></table></div>
        ) : <div className="empty-state"><Users size={22} /><span>No teachers found.</span></div>}
      </section>
    </>
  );
}

function RSVPsPage() {
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    fetchRSVPs().then(setRsvps).catch((cause) => setError(messageFrom(cause))).finally(() => setLoading(false));
  }, []);
  const teacherRsvps = rsvps.filter((rsvp) => rsvp.invitation_category === 'teacher');
  const publicRsvps = rsvps.filter((rsvp) => rsvp.invitation_category === 'public');

  function renderResponses(items: RSVP[], emptyMessage: string) {
    if (loading) return <div className="empty-state">Loading responses…</div>;
    if (error) return <div className="empty-state">Responses could not be loaded.</div>;
    if (!items.length) return <div className="empty-state"><Clipboard size={22} /><span>{emptyMessage}</span></div>;

    return (
      <div className="table-scroll">
        <table>
          <thead><tr><th>GUEST</th><th>EVENT</th><th>RESPONSE</th><th>GUESTS</th><th>DATE</th></tr></thead>
          <tbody>
            {items.map((rsvp) => (
              <tr key={rsvp.id}>
                <td><strong>{rsvp.guest_name || rsvp.invitation?.guest?.full_name || rsvp.guest?.full_name || 'Guest'}</strong></td>
                <td>{rsvp.event?.title ?? '—'}</td>
                <td><span className={`status-pill status-${rsvp.response}`}>{rsvp.response}</span></td>
                <td>{rsvp.guest_count}</td>
                <td>{new Date(rsvp.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <PageHeading title="RSVPs" description="Keep up with guest responses and attendance plans." />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="rsvp-columns">
        <section className="panel table-panel">
          <div className="panel-heading"><div><h2>Teacher RSVPs</h2><p>Responses from personalized teacher invitations.</p></div><span className="count-badge">{teacherRsvps.length}</span></div>
          {renderResponses(teacherRsvps, 'No teacher RSVPs yet.')}
        </section>
        <section className="panel table-panel">
          <div className="panel-heading"><div><h2>Public RSVPs</h2><p>Responses from the public invitation.</p></div><span className="count-badge">{publicRsvps.length}</span></div>
          {renderResponses(publicRsvps, 'No public RSVPs yet.')}
        </section>
      </div>
    </>
  );
}

function EventSettingsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormData>({
    title: '',
    description: '',
    event_date: null,
    countdown_at: null,
    event_timezone: 'Asia/Shanghai',
    venue: '',
    organizer: '',
  });
  const [dateTimeValue, setDateTimeValue] = useState('');
  const [countdownTimeValue, setCountdownTimeValue] = useState('');
  const [countdownTargetEdited, setCountdownTargetEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  useEffect(() => {
    fetchEvents().then(setEvents).catch((cause) => setError(messageFrom(cause))).finally(() => setLoading(false));
  }, []);

  function startCreate() {
    setEditingEventId(null);
    setForm({ title: '', description: '', event_date: null, countdown_at: null, event_timezone: 'Asia/Shanghai', venue: '', organizer: '' });
    setDateTimeValue('');
    setCountdownTimeValue('');
    setCountdownTargetEdited(false);
    setError('');
    setFormOpen(true);
  }

  function startEdit(event: Event) {
    const eventDateValue = event.event_date ?? event.starts_at;
    const eventDateTimestamp = eventDateValue ? new Date(eventDateValue).getTime() : Number.NaN;
    const countdownTimestamp = event.countdown_at ? new Date(event.countdown_at).getTime() : Number.NaN;
    const countdownIsLinked = !Number.isFinite(countdownTimestamp) ||
      countdownTimestamp === eventDateTimestamp ||
      (Number.isFinite(eventDateTimestamp) && eventDateTimestamp > Date.now() && countdownTimestamp < Date.now());
    const countdownValue = countdownIsLinked ? '' : event.countdown_at;
    setEditingEventId(event.id);
    setForm({
      title: event.title,
      description: event.description ?? '',
      event_date: event.event_date,
      countdown_at: event.countdown_at,
      event_timezone: event.event_timezone || 'Asia/Shanghai',
      venue: event.venue ?? '',
      organizer: event.organizer ?? '',
    });
    setDateTimeValue(eventDateValue ? toLocalDateTimeValue(eventDateValue) : '');
    setCountdownTimeValue(countdownValue ? toLocalDateTimeValue(countdownValue) : '');
    setCountdownTargetEdited(false);
    setError('');
    setFormOpen(true);
  }

  async function saveEvent(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setSaving(true);
    setError('');
    const eventData: EventFormData = {
      ...form,
      event_date: dateTimeValue ? new Date(dateTimeValue).toISOString() : null,
      countdown_at: countdownTimeValue ? new Date(countdownTimeValue).toISOString() : null,
    };
    if (editingEventId && !countdownTargetEdited) {
      const currentEvent = events.find((event) => event.id === editingEventId);
      if (currentEvent) {
        const currentEventDate = currentEvent.event_date ?? currentEvent.starts_at;
        const eventDateChanged = currentEventDate
          ? !eventData.event_date || new Date(currentEventDate).getTime() !== new Date(eventData.event_date).getTime()
          : Boolean(eventData.event_date);
        eventData.countdown_at = eventDateChanged ? null : currentEvent.countdown_at;
      }
    }
    try {
      if (editingEventId) {
        const updatedEvent = await updateEvent(editingEventId, eventData);
        setEvents((current) => current.map((event) => event.id === updatedEvent.id ? updatedEvent : event));
      } else {
        const createdEvent = await createEvent(eventData);
        setEvents((current) => [createdEvent, ...current]);
      }
      setFormOpen(false);
      setEditingEventId(null);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(event: Event) {
    const confirmed = window.confirm(
      `Deleting "${event.title}" will also permanently delete its invitations, RSVP records, QR scans, public settings, and media records. This cannot be undone. Delete this event?`
    );
    if (!confirmed) return;

    setDeletingEventId(event.id);
    setError('');
    try {
      await deleteEvent(event.id);
      setEvents((current) => current.filter((item) => item.id !== event.id));
      if (editingEventId === event.id) {
        setFormOpen(false);
        setEditingEventId(null);
      }
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setDeletingEventId(null);
    }
  }

  return (
    <>
      <PageHeading
        title="Event settings"
        description="Review and manage the events connected to your invitation workspace."
        action={!formOpen && <button className="button button-primary" type="button" onClick={startCreate}><Plus size={15} />Add event</button>}
      />
      {error && <Notice tone="error">{error}</Notice>}
      {formOpen && (
        <section className="panel event-form-panel">
          <div className="panel-heading">
            <div><h2>{editingEventId ? 'Edit event' : 'Add an event'}</h2><p>Enter the event details for your invitation workspace.</p></div>
          </div>
          <form className="form-stack" onSubmit={saveEvent}>
            <div className="event-form-grid">
              <label>
                Event name
                <input required maxLength={150} value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} />
              </label>
              <label>
                Date and time
                <input
                  type="datetime-local"
                  value={dateTimeValue}
                  onChange={(e) => {
                    setDateTimeValue(e.target.value);
                    if (!countdownTargetEdited) setCountdownTimeValue('');
                  }}
                />
              </label>
              <label>
                Countdown target date and time
                <input type="datetime-local" value={countdownTimeValue} onChange={(e) => { setCountdownTimeValue(e.target.value); setCountdownTargetEdited(true); }} />
                <small className="field-help">Changing the event date and time makes the countdown follow it unless you edit this target too.</small>
              </label>
              <label>
                Time zone
                <input value={form.event_timezone} onChange={(e) => setForm((current) => ({ ...current, event_timezone: e.target.value }))} placeholder="Asia/Shanghai" />
              </label>
              <label>
                Venue
                <input value={form.venue} onChange={(e) => setForm((current) => ({ ...current, venue: e.target.value }))} />
              </label>
              <label>
                Organizer
                <input value={form.organizer} onChange={(e) => setForm((current) => ({ ...current, organizer: e.target.value }))} />
              </label>
              <label className="event-description-field">
                Description
                <textarea rows={3} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
              </label>
            </div>
            <div className="event-form-actions">
              <button className="button" type="button" disabled={saving} onClick={() => { setFormOpen(false); setEditingEventId(null); }}>Cancel</button>
              <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingEventId ? 'Save changes' : 'Create event'}</button>
            </div>
          </form>
        </section>
      )}
      <section className="settings-grid">
        {events.map((event) => (
          <article className="panel event-card" key={event.id}>
            <span className="event-card-icon"><CalendarDays size={18} /></span>
            <span className="eyebrow">FESTIVAL EVENT</span>
            <h2>{event.title}</h2>
            <p>{event.description || 'No description added yet.'}</p>
            <dl>
              <div><dt>Date</dt><dd>{event.event_date ? new Date(event.event_date).toLocaleString() : 'Not set'}</dd></div>
              <div><dt>Venue</dt><dd>{event.venue || 'Not set'}</dd></div>
              <div><dt>Organizer</dt><dd>{event.organizer || 'Not set'}</dd></div>
            </dl>
            <div className="event-card-actions">
              <span className={`status-pill ${event.is_published ? 'status-active' : 'status-revoked'}`}>{event.is_published ? 'Published' : 'Draft'}</span>
              <div className="event-card-buttons">
                <button className="button button-quiet" type="button" disabled={deletingEventId !== null} onClick={() => startEdit(event)}><Pencil size={13} />Edit</button>
                <button className="button button-quiet button-danger" type="button" disabled={deletingEventId !== null} onClick={() => removeEvent(event)}><Trash2 size={13} />{deletingEventId === event.id ? 'Deleting…' : 'Delete'}</button>
              </div>
            </div>
          </article>
        ))}
        {!loading && !events.length && (error ? <div className="panel empty-state">Event details could not be loaded.</div> : <div className="panel empty-state"><CalendarDays size={22} /><span>No events are configured yet. Add an event to get started.</span></div>)}
      </section>
    </>
  );
}

function AdminSettingsPage() {
  const { logoUrl, setLogoUrl, logoError } = useAppBranding();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoSaveError, setLogoSaveError] = useState('');
  const [logoMessage, setLogoMessage] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (newPassword.length < 8) {
      setPasswordError('Choose a password with at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }

    setPasswordBusy(true);
    try {
      await changeAdminPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('Admin password changed successfully.');
    } catch (cause) {
      setPasswordError(messageFrom(cause));
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleLogoSave() {
    if (!logoFile) {
      setLogoSaveError('Choose a logo image first.');
      return;
    }

    setLogoBusy(true);
    setLogoSaveError('');
    setLogoMessage('');
    try {
      const url = await uploadAppLogo(logoFile);
      await saveAppLogo(url);
      setLogoUrl(url);
      setLogoFile(null);
      if (logoInputRef.current) logoInputRef.current.value = '';
      setLogoMessage('App logo updated. It is now used throughout the admin app, QR pages, and print invitations.');
    } catch (cause) {
      setLogoSaveError(messageFrom(cause));
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleLogoRemove() {
    setLogoBusy(true);
    setLogoSaveError('');
    setLogoMessage('');
    try {
      await saveAppLogo('');
      setLogoUrl('');
      setLogoFile(null);
      if (logoInputRef.current) logoInputRef.current.value = '';
      setLogoMessage('Custom app logo removed. The default logo is now in use.');
    } catch (cause) {
      setLogoSaveError(messageFrom(cause));
    } finally {
      setLogoBusy(false);
    }
  }

  return (
    <>
      <PageHeading title="Settings" description="Manage your admin password and the shared app logo." />
      {logoError && <Notice tone="error">Shared app logo settings could not be loaded: {logoError}</Notice>}
      <div className="settings-grid admin-settings-grid">
        <section className="panel admin-setting-panel">
          <div className="panel-heading">
            <div><h2>Change admin password</h2><p>Verify your current password before choosing a new one.</p></div>
          </div>
          <form className="form-stack" onSubmit={(event) => void handlePasswordChange(event)}>
            <label>
              Current password
              <input autoComplete="current-password" type="password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </label>
            <label>
              New password
              <input autoComplete="new-password" type="password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </label>
            <label>
              Confirm new password
              <input autoComplete="new-password" type="password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
            {passwordError && <Notice tone="error">{passwordError}</Notice>}
            {passwordMessage && <Notice tone="info">{passwordMessage}</Notice>}
            <button className="button button-primary" type="submit" disabled={passwordBusy}>
              {passwordBusy ? 'Changing password…' : 'Change password'}
            </button>
          </form>
        </section>
        <section className="panel admin-setting-panel">
          <div className="panel-heading">
            <div><h2>App logo</h2><p>One shared logo appears in the admin app and on every teacher and public QR page.</p></div>
          </div>
          <div className="shared-logo-preview">
            {logoUrl ? <img src={logoUrl} alt="Current app logo" /> : <span className="brand-mark">H</span>}
            <span>{logoUrl ? 'Current shared logo' : 'Using the default logo'}</span>
          </div>
          <input
            ref={logoInputRef}
            className="visually-hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Upload shared app logo"
            onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
          />
          <div className="teacher-actions">
            <button className="button" type="button" disabled={logoBusy} onClick={() => logoInputRef.current?.click()}><Upload size={15} />Choose logo</button>
            <button className="button button-primary" type="button" disabled={logoBusy || !logoFile} onClick={() => void handleLogoSave()}>{logoBusy ? 'Saving…' : 'Save app logo'}</button>
            {logoUrl && <button className="button button-danger" type="button" disabled={logoBusy} onClick={() => void handleLogoRemove()}>Remove logo</button>}
          </div>
          <p className="teacher-import-help">{logoFile?.name ?? 'PNG, JPG, or WebP · 5 MB max'}</p>
          {logoSaveError && <Notice tone="error">{logoSaveError}</Notice>}
          {logoMessage && <Notice tone="info">{logoMessage}</Notice>}
        </section>
      </div>
    </>
  );
}

function toLocalDateTimeValue(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function InvitationEnvelopeLoader({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) onComplete();
  }, [onComplete]);

  return (
    <div className="invitation-envelope-loader" role="status" aria-label="Loading invitation">
      <div className="qr-envelope-scene" aria-hidden="true">
        <div className="qr-envelope">
          <div className="qr-envelope-back" />
          <div className="qr-envelope-sheet qr-envelope-sheet-back" />
          <div className="qr-envelope-sheet qr-envelope-sheet-middle" />
          <div className="qr-envelope-sheet qr-envelope-sheet-front" onAnimationEnd={onComplete}>
            <span>YOU’RE INVITED</span>
            <i />
            <i />
            <i />
          </div>
          <div className="qr-envelope-flap" />
          <div className="qr-envelope-front" />
          <div className="qr-envelope-seal">H</div>
        </div>
      </div>
      <span className="invitation-envelope-loader-caption">An invitation for you</span>
      <span className="visually-hidden">Loading invitation</span>
    </div>
  );
}

function TeacherEnvelopeIntro({ ready, onOpen }: { ready: boolean; onOpen: () => void }) {
  const [opening, setOpening] = useState(false);

  function openInvitation() {
    if (!ready || opening) return;
    setOpening(true);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) onOpen();
  }

  return (
    <div className="qr-envelope-intro">
      <p className="qr-envelope-intro-brand">A celebration of cultures · Bangladesh × China</p>
      <div className={`qr-envelope-intro-scene${opening ? ' is-opening' : ''}`}>
        <div className="qr-envelope-intro-wrap" aria-hidden="true">
          <div className="qr-envelope-intro-back" />
          <div className="qr-envelope-intro-left" />
          <div className="qr-envelope-intro-right" />
          <div className="qr-envelope-intro-bottom" />
          <div className="qr-envelope-intro-preview">
            <div>
              <small>University cultural festival</small>
              <strong>Across<br />Cultures</strong>
              <span>Honouring teachers · Sharing traditions</span>
            </div>
          </div>
          <div
            className="qr-envelope-intro-flap"
            onTransitionEnd={(event) => {
              if (opening && event.propertyName === 'transform') onOpen();
            }}
          />
          <div className="qr-envelope-intro-seal" />
          <div className="qr-envelope-intro-seal-half left" />
          <div className="qr-envelope-intro-seal-half right" />
        </div>
        <button
          className="qr-envelope-intro-open"
          type="button"
          disabled={!ready || opening}
          onClick={openInvitation}
          aria-label="Break the seal and open the teacher invitation"
        />
      </div>
      <p className="qr-envelope-intro-note" role="status">
        {opening ? 'Your invitation is unfolding…' : ready ? 'Tap to break the seal & open your invitation' : 'Preparing your invitation…'}
      </p>
    </div>
  );
}

function PublicInvitationPage() {
  const { token = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [envelopeComplete, setEnvelopeComplete] = useState(false);
  const [error, setError] = useState('');
  const [guestName, setGuestName] = useState('');
  const [wechatAuthLoading, setWechatAuthLoading] = useState(false);
  const [response, setResponse] = useState<'accepted' | 'maybe' | 'declined'>('accepted');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const wechatOAuthStarted = useRef(false);

  useEffect(() => {
    fetchPublicInvitation(token)
      .then((result) => {
        setEvent(result.event);
        setWelcomeMessage(result.settings.welcome_message || 'Welcome to the HDU Cultural Festival. We are delighted to have you join us.');
      })
      .catch((cause) => setError(messageFrom(cause)))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (loading || !event) return;

    const query = new URLSearchParams(location.search);
    const code = query.get('code');
    const oauthError = query.get('errcode') || query.get('error');
    const stateKey = `public-rsvp-wechat-state:${token}`;

    if ((code || oauthError) && wechatOAuthStarted.current) return;
    if (code) {
      wechatOAuthStarted.current = true;
      let expectedState: string | null;
      try {
        expectedState = window.sessionStorage.getItem(stateKey);
        window.sessionStorage.removeItem(stateKey);
      } catch (cause) {
        setError(`WeChat name could not be verified: ${messageFrom(cause)}. Enter your name manually.`);
        navigate(location.pathname, { replace: true });
        return;
      }

      navigate(location.pathname, { replace: true });
      if (!expectedState || expectedState !== query.get('state')) {
        setError('WeChat sign-in could not be verified. Please enter your name manually.');
        return;
      }

      setWechatAuthLoading(true);
      fetchWeChatNickname(code)
        .then(setGuestName)
        .catch((cause) => setError(`WeChat name could not be loaded: ${messageFrom(cause)}. Enter your name manually.`))
        .finally(() => setWechatAuthLoading(false));
      return;
    }

    if (oauthError) {
      wechatOAuthStarted.current = true;
      let cleanupMessage = '';
      try {
        window.sessionStorage.removeItem(stateKey);
      } catch (cause) {
        cleanupMessage = ` ${messageFrom(cause)}`;
      }
      navigate(location.pathname, { replace: true });
      setError(`WeChat sign-in was not completed. Please enter your name manually.${cleanupMessage}`);
      return;
    }

    if (!isWeChatBrowser() || wechatOAuthStarted.current) return;
    wechatOAuthStarted.current = true;

    const state = crypto.randomUUID();
    try {
      window.sessionStorage.setItem(stateKey, state);
    } catch (cause) {
      setError(`WeChat sign-in could not be started: ${messageFrom(cause)}. Enter your name manually.`);
      return;
    }

    const redirectUri = new URL(location.pathname, window.location.origin).toString();
    setWechatAuthLoading(true);
    getWeChatAuthorizationUrl(redirectUri, state)
      .then((authorizationUrl) => {
        const destination = new URL(authorizationUrl);
        if (destination.origin !== 'https://open.weixin.qq.com') {
          throw new Error('Unexpected WeChat authorization address.');
        }
        window.location.assign(destination.toString());
      })
      .catch((cause) => {
        try {
          window.sessionStorage.removeItem(stateKey);
        } catch (storageCause) {
          setError(`WeChat sign-in failed: ${messageFrom(cause)}. Name storage also failed: ${messageFrom(storageCause)}.`);
          setWechatAuthLoading(false);
          return;
        }
        setError(`WeChat sign-in failed: ${messageFrom(cause)}. Enter your name manually.`);
        setWechatAuthLoading(false);
      });
  }, [event, loading, location.pathname, location.search, navigate, token]);

  async function sendPublicRSVP(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    if (!event) return;
    setBusy(true);
    setError('');
    try {
      await submitRSVP({
        event_id: event.id,
        guest_name: guestName,
        guest_count: 1,
        response,
        invitation_category: 'public',
        token_hash: token,
      });
      setSubmitted(true);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="invite-screen">
      <div className="invite-brand"><Brand /></div>
      {loading || !envelopeComplete || wechatAuthLoading ? <InvitationEnvelopeLoader onComplete={() => setEnvelopeComplete(true)} /> : error && !event ? <div className="invite-card invite-error"><span className="event-card-icon"><DoorOpen size={20} /></span><h1>Invitation unavailable</h1><p>{error}</p></div> : event ? (
        <article className="invite-card">
          <span className="eyebrow">PUBLIC INVITATION</span>
          <div className="invite-decor">✳</div>
          <h1>{event.title}</h1>
          <p className="invite-welcome">{welcomeMessage}</p>
          <div className="invite-details">
            {event.event_date && <div><CalendarDays size={17} /><span><strong>{new Date(event.event_date).toLocaleString()}</strong><small>{event.event_timezone}</small></span></div>}
            {event.venue && <div><DoorOpen size={17} /><span><strong>{event.venue}</strong><small>Event venue</small></span></div>}
          </div>
          {submitted ? (
            <div className="submitted-state"><span className="success-check"><Check size={21} /></span><h2>Thank you for responding</h2><p>Your RSVP has been recorded. We look forward to seeing you.</p></div>
          ) : (
            <form className="form-stack rsvp-form" onSubmit={sendPublicRSVP}>
              <h2>Will you join us?</h2>
              <label>Your name<input required maxLength={150} value={guestName} onChange={(e) => setGuestName(e.target.value)} /><small className="field-help">Your WeChat name fills automatically when opened in WeChat. Otherwise, enter your name.</small></label>
              <label>Response<select value={response} onChange={(e) => setResponse(e.target.value as typeof response)}><option value="accepted">Accept with pleasure</option><option value="maybe">Maybe</option><option value="declined">Unable to attend</option></select></label>
              {error && <Notice tone="error">{error}</Notice>}
              <button className="button button-primary button-wide" disabled={busy}>{busy ? 'Sending response…' : 'Send RSVP'}<Send size={16} /></button>
            </form>
          )}
        </article>
      ) : null}
      <p className="invite-footer">HDU Cultural Festival · Hangzhou Dianzi University</p>
    </main>
  );
}

function InvitationPage() {
  const { token = '' } = useParams();
  const { logoUrl } = useAppBranding();
  const [invitation, setInvitation] = useState<ValidateInvitationResponse['invitation'] | null>(null);
  const [qrTheme, setQrTheme] = useState<QrLandingPageTheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [envelopeComplete, setEnvelopeComplete] = useState(false);
  const [error, setError] = useState('');
  const [qrThemeError, setQrThemeError] = useState('');
  const [response, setResponse] = useState<'accepted' | 'maybe' | 'declined'>('accepted');
  const [guestName, setGuestName] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rsvpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInvitation(token)
      .then((result) => {
        if (!result.valid || !result.invitation) throw new Error(result.error ?? 'This invitation is not available.');
        setInvitation(result.invitation);
        setGuestName(result.invitation.teacher?.full_name ?? '');
        setSubmitted(result.rsvp_submitted ?? false);
      })
      .catch((cause) => setError(messageFrom(cause)))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    let active = true;
    fetchQrLandingPageTheme()
      .then((theme) => active && setQrTheme(theme))
      .catch((cause) => active && setQrThemeError(messageFrom(cause)));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (loading || !envelopeComplete) return;

    const revealTargets = document.querySelectorAll<HTMLElement>('.qr-template [data-qr-reveal]');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      revealTargets.forEach((element) => element.classList.add('qr-template-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('qr-template-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14 });
    revealTargets.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [loading, envelopeComplete]);

  const event = invitation?.event;
  const teacher = invitation?.teacher;
  const page = { ...defaultLandingPageConfig, ...(invitation?.landing_page_config ?? {}) };
  const sharedThemeConfigured = qrTheme !== null && landingPageFontKeys.some((key) =>
    Object.prototype.hasOwnProperty.call(qrTheme.font_families, key) ||
    Object.prototype.hasOwnProperty.call(qrTheme.font_colors, key)
  );
  const pageFontStyle = (key: InvitationLandingPageFontKey, fallbackKey?: InvitationLandingPageFontKey) => {
    const fontFamilies = sharedThemeConfigured ? qrTheme?.font_families : page.font_families;
    const fontColors = sharedThemeConfigured ? qrTheme?.font_colors : page.font_colors;
    const fontFamily = fontFamilies?.[key]?.trim() ||
      (fallbackKey ? fontFamilies?.[fallbackKey]?.trim() : '') ||
      (sharedThemeConfigured ? qrTheme?.font_family : page.font_family);
    const color = fontColors?.[key]?.trim() ||
      (fallbackKey ? fontColors?.[fallbackKey]?.trim() : '');
    return {
      fontFamily: fontFamily ? fontFamilyValue(fontFamily) : undefined,
      color: color || undefined,
    };
  };
  const defaultPageFont = fontFamilyValue(sharedThemeConfigured ? qrTheme?.font_family ?? '' : page.font_family);
  const eventDateValue = event?.event_date || event?.starts_at;
  const eventDateTimestamp = eventDateValue ? new Date(eventDateValue).getTime() : Number.NaN;
  const configuredCountdownTimestamp = event?.countdown_at ? new Date(event.countdown_at).getTime() : Number.NaN;
  const hasUpcomingEventDate = Number.isFinite(eventDateTimestamp) && eventDateTimestamp > Date.now();
  const eventTimestamp = Number.isFinite(configuredCountdownTimestamp) &&
    (configuredCountdownTimestamp > Date.now() || !hasUpcomingEventDate)
    ? configuredCountdownTimestamp
    : eventDateTimestamp;

  useEffect(() => {
    if (!Number.isFinite(eventTimestamp)) return;
    const updateCountdown = () => setCountdownSeconds(Math.max(0, Math.floor((eventTimestamp - Date.now()) / 1000)));
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [eventTimestamp]);

  useEffect(() => {
    setMusicPlaying(false);
    if (audioRef.current) audioRef.current.pause();
  }, [page.music_url]);

  async function sendRSVP(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    if (!invitation || !event) return;
    setBusy(true);
    setError('');
    try {
      await submitRSVP({
        invitation_id: invitation.id,
        event_id: event.id,
        guest_name: guestName,
        guest_count: 1,
        response,
        invitation_category: 'teacher',
        token,
      });
      setSubmitted(true);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  }

  async function toggleMusic() {
    if (!page.music_url || !audioRef.current) return;
    if (musicPlaying) {
      audioRef.current.pause();
      setMusicPlaying(false);
      return;
    }

    try {
      await audioRef.current.play();
      setMusicPlaying(true);
    } catch (cause) {
      setError(messageFrom(cause));
    }
  }

  function showRSVPForm() {
    setRsvpOpen(true);
    window.setTimeout(() => rsvpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }

  const countdown = {
    days: Math.floor(countdownSeconds / 86_400),
    hours: Math.floor((countdownSeconds % 86_400) / 3_600),
    minutes: Math.floor((countdownSeconds % 3_600) / 60),
    seconds: countdownSeconds % 60,
  };
  const guestHeading = [teacher?.designation, teacher?.full_name].filter(Boolean).join(' ');
  let eventDateLabel = '';
  let eventTimeLabel = '';
  if (eventDateValue) {
    const date = new Date(eventDateValue);
    if (Number.isFinite(date.getTime())) {
      try {
        eventDateLabel = new Intl.DateTimeFormat('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          timeZone: event?.event_timezone || 'Asia/Shanghai',
        }).format(date);
        eventTimeLabel = new Intl.DateTimeFormat('en-US', {
          hour: 'numeric', minute: '2-digit',
          timeZone: event?.event_timezone || 'Asia/Shanghai',
        }).format(date);
      } catch {
        eventDateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        eventTimeLabel = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      }
    }
  }

  return (
    <main
      className={`invite-screen festival-invite-screen qr-template${envelopeComplete ? ' qr-template-page-reveal' : ''}${defaultPageFont.trim() ? ' qr-template-custom-font' : ''}`}
      style={{ fontFamily: defaultPageFont.trim() || undefined }}
    >
      {!envelopeComplete ? <TeacherEnvelopeIntro ready={!loading} onOpen={() => setEnvelopeComplete(true)} /> : error && !invitation ? <div className="invite-card invite-error"><span className="event-card-icon"><DoorOpen size={20} /></span><h1>Invitation unavailable</h1><p>{error}</p></div> : invitation && event ? (
        <>
          {page.page_background_url && (
            <div className="festival-page-background" aria-hidden="true">
              {isVideoAnimation(page.page_background_url)
                ? <video src={page.page_background_url} autoPlay loop muted playsInline style={{ objectPosition: page.page_background_position }} />
                : <img src={page.page_background_url} alt="" style={{ objectPosition: page.page_background_position }} />}
              <div className="festival-page-background-overlay" style={{ opacity: page.page_background_overlay / 100 }} />
            </div>
          )}
          {page.confetti_enabled && <div className="festival-confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>}
          {page.music_url && <audio ref={audioRef} src={page.music_url} loop onEnded={() => setMusicPlaying(false)} />}
          <section className="qr-template-hero">
            <header className="qr-template-header" data-qr-reveal="">
              <a className="qr-template-brand" href="#invitation-top" aria-label={page.university_heading}>
                {logoUrl
                  ? <img src={logoUrl} alt="" />
                  : <span className="qr-template-logo-placeholder">HDU</span>}
                <span style={pageFontStyle('university_heading')}>{page.university_heading}</span>
              </a>
              <nav aria-label="Invitation navigation">
                <a href="#event-details" style={pageFontStyle('navigation')}>Event details</a>
                <a href="#rsvp" style={pageFontStyle('navigation')}>RSVP</a>
                <button className="qr-template-audio" type="button" onClick={() => void toggleMusic()} disabled={!page.music_url} aria-label={musicPlaying ? 'Pause background music' : 'Play background music'} title={page.music_url ? 'Toggle background music' : 'No background music set'}>
                  {musicPlaying ? <Volume2 size={17} /> : <VolumeX size={17} />}
                </button>
              </nav>
            </header>
            {error && <div className="qr-template-error"><Notice tone="error">{error}</Notice></div>}
            {qrThemeError && <div className="qr-template-error"><Notice tone="error">{qrThemeError}</Notice></div>}
            <div className="qr-template-hero-content" id="invitation-top" data-qr-reveal="">
              <p className="qr-template-eyebrow" style={pageFontStyle('invitation_badge')}>{page.invitation_badge}</p>
              <h1 style={pageFontStyle('festival_title')}>{page.festival_title}</h1>
              <p className="qr-template-tagline" style={pageFontStyle('tagline')}>{page.tagline}</p>
              <article className="qr-template-cover">
                <span className="qr-template-cover-kicker" style={pageFontStyle('university_heading')}>{page.university_heading}</span>
                <p className="qr-template-cover-invite" style={pageFontStyle('cover_invitation')}>You are warmly invited</p>
                <h2 style={pageFontStyle('teacher_name')}>{guestHeading || 'Distinguished Guest'}</h2>
                {teacher?.department && <p className="qr-template-cover-department" style={pageFontStyle('teacher_department')}>{teacher.department}</p>}
                <p className="qr-template-cover-message" style={pageFontStyle('letter_message')}>{invitation.letter_content || teacher?.personalized_message || `Please join us for ${event.title}. We would be honored by your presence.`}</p>
                {eventDateLabel && <p className="qr-template-cover-date" style={pageFontStyle('event_date')}>{eventDateLabel}{eventTimeLabel ? ` · ${eventTimeLabel}` : ''}</p>}
              </article>
              <a className="qr-template-scroll-link" href="#welcome" style={pageFontStyle('cover_navigation')}>Discover the invitation <span aria-hidden="true">↓</span></a>
            </div>
          </section>

          <section className="qr-template-section qr-template-welcome" id="welcome" data-qr-reveal="">
            <p className="qr-template-eyebrow" style={pageFontStyle('welcome_eyebrow')}>A note for you</p>
            <h2 style={pageFontStyle('welcome_heading')}>A warm welcome</h2>
            <p style={pageFontStyle('welcome_body')}>{event.description || page.tagline}</p>
            {teacher?.personalized_message && teacher.personalized_message !== invitation.letter_content && (
              <p className="qr-template-personal-note" style={pageFontStyle('personal_note')}>{teacher.personalized_message}</p>
            )}
          </section>

          <section className="qr-template-section qr-template-details" id="event-details" data-qr-reveal="">
            <p className="qr-template-eyebrow" style={pageFontStyle('section_eyebrow')}>The gathering</p>
            <h2 style={pageFontStyle('details_heading')}>Event details</h2>
            <p className="qr-template-section-intro" style={pageFontStyle('details_intro')}>Everything you need to know about the celebration.</p>
            <div className="qr-template-detail-grid">
              <article data-qr-reveal=""><span style={pageFontStyle('detail_label')}>Event</span><strong style={pageFontStyle('event_title', 'detail_value')}>{event.title}</strong></article>
              <article data-qr-reveal=""><span style={pageFontStyle('detail_label')}>Date</span><strong style={pageFontStyle('event_date', 'detail_value')}>{eventDateLabel || 'To be announced'}</strong></article>
              <article data-qr-reveal=""><span style={pageFontStyle('detail_label')}>Time</span><strong style={pageFontStyle('event_time', 'detail_value')}>{eventTimeLabel || 'To be announced'}</strong>{eventTimeLabel && <small style={pageFontStyle('event_meta')}>{event.event_timezone}</small>}</article>
              <article data-qr-reveal=""><span style={pageFontStyle('detail_label')}>Venue</span><strong style={pageFontStyle('venue_name', 'detail_value')}>{page.venue_name || event.venue || 'To be announced'}</strong></article>
              <article data-qr-reveal=""><span style={pageFontStyle('detail_label')}>Dress code</span><strong style={pageFontStyle('dress_code', 'detail_value')}>{page.dress_code || 'As you feel comfortable'}</strong></article>
              <article data-qr-reveal=""><span style={pageFontStyle('detail_label')}>Hosted by</span><strong style={pageFontStyle('organizer', 'detail_value')}>{page.organizer || event.organizer || page.university_heading}</strong></article>
            </div>
          </section>

          {Number.isFinite(eventTimestamp) && (
            <section className="qr-template-countdown" aria-label={page.countdown_label} data-qr-reveal="">
              <p className="qr-template-eyebrow" style={pageFontStyle('countdown_eyebrow')}>Until we celebrate</p>
              <h2 style={pageFontStyle('countdown_label')}>{page.countdown_label}</h2>
              <div className="qr-template-countdown-grid">
                {([
                  ['days', countdown.days],
                  ['hours', countdown.hours],
                  ['minutes', countdown.minutes],
                  ['seconds', countdown.seconds],
                ] as const).map(([label, value]) => (
                  <div key={label}><strong style={pageFontStyle('countdown_value')}>{String(value).padStart(2, '0')}</strong><span style={pageFontStyle('countdown_unit')}>{label}</span></div>
                ))}
              </div>
            </section>
          )}

          <section className="qr-template-section qr-template-location" data-qr-reveal="">
            <p className="qr-template-eyebrow" style={pageFontStyle('location_eyebrow')}>Find your way</p>
            <h2 style={pageFontStyle('location_heading')}>The location</h2>
            <div className={`qr-template-location-card${event.poster_url ? ' has-poster' : ''}`}>
              <div>
                <span className="qr-template-eyebrow" style={pageFontStyle('location_label')}>Where we’ll meet</span>
                <h3 style={pageFontStyle('venue_name')}>{page.venue_name || event.venue || 'Venue to be announced'}</h3>
                {page.venue_detail && <p style={pageFontStyle('venue_detail')}>{page.venue_detail}</p>}
                {(page.address || event.address) && <p style={pageFontStyle('address')}>{page.address || event.address}</p>}
                {page.subway_guide && <p style={pageFontStyle('subway_guide')}><strong style={pageFontStyle('location_label')}>Getting there:</strong> {page.subway_guide}</p>}
                {page.campus_gate && <p style={pageFontStyle('campus_gate')}><strong style={pageFontStyle('location_label')}>Campus gate:</strong> {page.campus_gate}</p>}
                {page.campus_gate_chinese && <p style={pageFontStyle('campus_gate_chinese')}><strong style={pageFontStyle('location_label')}>Campus gate:</strong> {page.campus_gate_chinese}</p>}
                <div className="qr-template-map-links">
                  {page.amap_url && <a href={page.amap_url} target="_blank" rel="noreferrer" style={pageFontStyle('amap_url')}>Open in Amap</a>}
                  {page.tencent_map_url && <a href={page.tencent_map_url} target="_blank" rel="noreferrer" style={pageFontStyle('tencent_map_url')}>Open in Tencent Maps</a>}
                </div>
              </div>
              {event.poster_url && <img src={event.poster_url} alt={`${event.title} event poster`} />}
            </div>
          </section>

          <section className="qr-template-section qr-template-rsvp" id="rsvp" ref={rsvpRef} data-qr-reveal="">
            <p className="qr-template-eyebrow" style={pageFontStyle('rsvp_eyebrow')}>We hope you can join us</p>
            {submitted ? (
              <div className="qr-template-thanks">
                <span className="success-check"><Check size={21} /></span>
                <h2 style={pageFontStyle('rsvp_heading')}>Thank you, {guestName}</h2>
                <p style={pageFontStyle('rsvp_body')}>Your RSVP has been recorded. We look forward to celebrating with you.</p>
              </div>
            ) : (
              <>
                <h2 style={pageFontStyle('rsvp_heading')}>Kindly RSVP</h2>
                <p style={pageFontStyle('rsvp_body')}>Please let us know if you can join us.</p>
                {!rsvpOpen ? (
                  <button className="qr-template-rsvp-button" type="button" style={pageFontStyle('rsvp_button')} onClick={showRSVPForm}>Confirm your attendance</button>
                ) : (
                  <form className="qr-template-rsvp-form" style={pageFontStyle('rsvp_form')} onSubmit={sendRSVP}>
                    <label style={pageFontStyle('rsvp_form')}>Your name<input required value={guestName} onChange={(e) => setGuestName(e.target.value)} /></label>
                    <label style={pageFontStyle('rsvp_form')}>Response<select value={response} onChange={(e) => setResponse(e.target.value as typeof response)}><option value="accepted">Accept with pleasure</option><option value="maybe">Maybe</option><option value="declined">Unable to attend</option></select></label>
                    {error && <Notice tone="error">{error}</Notice>}
                    <button className="qr-template-rsvp-button" type="submit" style={pageFontStyle('rsvp_button')} disabled={busy}>{busy ? 'Sending response…' : 'Send RSVP'}<Send size={15} /></button>
                  </form>
                )}
              </>
            )}
          </section>

          <footer className="qr-template-footer" data-qr-reveal="">
            <p className="qr-template-eyebrow" style={pageFontStyle('footer_eyebrow')}>With all our love</p>
            <h2 style={pageFontStyle('footer_heading')}>Thank you</h2>
            <p style={pageFontStyle('footer_body')}>We look forward to celebrating together.</p>
            <p className="qr-template-footer-organizer" style={pageFontStyle('organizer')}>{page.organizer || event.organizer || page.university_heading}</p>
            {(page.wechat || page.email) && (
              <p className="qr-template-footer-contact">
                {page.wechat && <span style={pageFontStyle('wechat')}>WeChat: {page.wechat}</span>}
                {page.wechat && page.email && ' · '}
                {page.email && <span style={pageFontStyle('email')}>Email: {page.email}</span>}
              </p>
            )}
            <a href="/admin/login" style={pageFontStyle('footer_link')}>Committee admin portal</a>
          </footer>
        </>
      ) : null}
    </main>
  );
}

function Notice({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export default App;
