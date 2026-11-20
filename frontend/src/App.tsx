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
  fetchPublicSettings,
  saveInvitationLetterDesign,
  saveAppLogo,
  submitRSVP,
  createPublicSettings,
  uploadAppLogo,
  updateTeacher,
  uploadInvitationPageAsset,
  updateEvent,
  updateInvitation,
  updatePublicSettings,
} from './services/api';
import type { DashboardStats, Event, EventFormData, Invitation, InvitationLandingPageConfig, PublicSettings, RSVP, Teacher, TeacherFormData, ValidateInvitationResponse } from './types';

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

const defaultLandingPageConfig: InvitationLandingPageConfig = {
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
  const [actionBusyId, setActionBusyId] = useState('');
  const [editingInvite, setEditingInvite] = useState<Invitation | null>(null);
  const [letterDraft, setLetterDraft] = useState('');
  const [landingDraft, setLandingDraft] = useState<InvitationLandingPageConfig>(defaultLandingPageConfig);
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
      const [nextEvents, nextTeachers, nextInvitations] = await Promise.all([fetchEvents(), fetchTeachers(), fetchInvitations()]);
      setEvents(nextEvents);
      setEventId((current) => current || nextEvents[0]?.id || '');
      setTeachers(nextTeachers);
      setInvitations(nextInvitations);
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
    if (!window.confirm(`Delete the invitation for ${invite.teacher?.full_name ?? 'this guest'}?`)) return;
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
    setEditingInvite(invite);
    setLetterDraft(invite.letter_content ?? '');
    setLandingDraft({
      ...defaultLandingPageConfig,
      ...(invite.landing_page_config ?? {}),
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

  const landingPageFields: Array<{
    key: Exclude<keyof InvitationLandingPageConfig, 'confetti_enabled'>;
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
    { key: 'subway_guide', label: 'Subway directions', multiline: true },
    { key: 'campus_gate', label: 'Campus gate address', multiline: true },
    { key: 'campus_gate_chinese', label: 'Campus gate address (Chinese)' },
    { key: 'amap_url', label: 'Amap map link' },
    { key: 'tencent_map_url', label: 'Tencent map link' },
    { key: 'organizer', label: 'Organizer / footer' , multiline: true },
    { key: 'wechat', label: 'WeChat contact' },
    { key: 'email', label: 'Contact email' },
  ];

  return (
    <>
      <PageHeading title="Invitations" description="Create and track personalized invitations for festival guests." />
      {error && <Notice tone="error">{error}</Notice>}
      <section className="panel create-form-panel">
        <div className="panel-heading"><div><h2>Create an invitation</h2><p>Choose an event and teacher to generate a unique, shareable invite link.</p></div></div>
        <form className="inline-form" onSubmit={createInvite}>
          <label>Event<select required value={eventId} onChange={(e) => setEventId(e.target.value)}><option value="">Select an event</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
          <label>Teacher<select required value={teacherId} onChange={(e) => setTeacherId(e.target.value)}><option value="">Select a teacher</option>{teachers.filter((teacher) => teacher.is_active).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}</select></label>
          <button className="button button-primary" disabled={busy || loading || !events.length || !teachers.length}><Plus size={16} />{busy ? 'Creating…' : 'Create invite'}</button>
        </form>
        {createdLink && <div className="success-link"><Check size={17} /><span><strong>Invitation created</strong><small>{createdLink}</small></span><button className="button button-quiet" onClick={copyLink}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy link'}</button></div>}
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
                <p>These details are shown on the page guests see after scanning this invitation.</p>
              </div>
              <div className="landing-editor-grid">
                {landingPageFields.map(({ key, label, multiline }) => (
                  <label className={multiline ? 'landing-editor-wide' : ''} key={key}>
                    {label}
                    {multiline
                      ? <textarea rows={2} value={landingDraft[key]} onChange={(event) => setLandingDraft((current) => ({ ...current, [key]: event.target.value }))} />
                      : <input type={key.endsWith('_url') ? 'url' : 'text'} value={landingDraft[key]} onChange={(event) => setLandingDraft((current) => ({ ...current, [key]: event.target.value }))} />}
                  </label>
                ))}
              </div>
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

const printDesignStorageKey = 'hdu-print-invitation-design-v1';
const defaultPrintableInvitationDesign: PrintableInvitationDesign = {
  brandText: 'HDU CULTURAL FESTIVAL',
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

    return (
      <article
        className="print-invitation-card"
        key={invite.id}
        style={{
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
            <span className="eyebrow">{design.brandText}</span>
          </div>
          <h2 style={{ color: design.accentColor }}>{design.heading}</h2>
          <h3>{invite.event?.title ?? 'Festival invitation'}</h3>
          <p className="print-invitation-name">Dear {teacherName},</p>
          <p>{design.message}</p>
          {personalMessage && <p>{personalMessage}</p>}
          {invite.event?.event_date && <p><strong>Date:</strong> {new Date(invite.event.event_date).toLocaleString()}</p>}
          {invite.event?.venue && <p><strong>Venue:</strong> {invite.event.venue}</p>}
          <p>{design.closing}</p>
          <small>{design.footer}</small>
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
                <label>Festival name or brand text<input value={design.brandText} maxLength={100} onChange={(event) => updateDesign('brandText', event.target.value)} /></label>
                <label className="print-logo-toggle">
                  <input type="checkbox" checked={design.showLogo} onChange={(event) => updateDesign('showLogo', event.target.checked)} />
                  <span>Show logo</span>
                </label>
                <label>Invitation heading<input value={design.heading} maxLength={100} onChange={(event) => updateDesign('heading', event.target.value)} /></label>
                <label>Invitation message<textarea rows={5} maxLength={2000} value={design.message} onChange={(event) => updateDesign('message', event.target.value)} /></label>
                <label>Closing message<input value={design.closing} maxLength={300} onChange={(event) => updateDesign('closing', event.target.value)} /></label>
                <label>Footer<input value={design.footer} maxLength={200} onChange={(event) => updateDesign('footer', event.target.value)} /></label>
                <label className="print-color-field">Accent color<input type="color" value={design.accentColor} onChange={(event) => updateDesign('accentColor', event.target.value)} /></label>
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
    const duplicate = teachers.find((teacher) =>
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
    if (!window.confirm(`Delete ${teacher.full_name}? Existing invitations and RSVP records will be preserved, and this teacher will no longer be available for new invitations.`)) return;
    setError('');
    setImportMessage('');
    try {
      await deleteTeacher(teacher.id);
      setTeachers((current) => current.map((item) => item.id === teacher.id ? { ...item, is_active: false } : item));
      setImportMessage(`${teacher.full_name} was removed from active teachers. Existing invitation history was preserved.`);
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
      const existingKeys = new Set(teachers.map((teacher) => [
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
      const rows = teachers.map((teacher) => ({
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
        <div className="panel-heading"><div><h2>Teacher directory</h2><p>{teachers.length} teachers in your workspace.</p></div><span className="count-badge">{teachers.length}</span></div>
        {loading ? <div className="empty-state">Loading teachers…</div> : error && !teachers.length ? <div className="empty-state">Teachers could not be loaded.</div> : teachers.length ? (
          <div className="table-scroll"><table><thead><tr><th>NAME</th><th>DESIGNATION</th><th>DEPARTMENT</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>
            {teachers.map((teacher) => {
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

function PublicInvitationPage() {
  const { token = '' } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [response, setResponse] = useState<'accepted' | 'maybe' | 'declined'>('accepted');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetchPublicInvitation(token)
      .then((result) => {
        setEvent(result.event);
        setWelcomeMessage(result.settings.welcome_message || 'Welcome to the HDU Cultural Festival. We are delighted to have you join us.');
      })
      .catch((cause) => setError(messageFrom(cause)))
      .finally(() => setLoading(false));
  }, [token]);

  async function sendPublicRSVP(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    if (!event) return;
    setBusy(true);
    setError('');
    try {
      await submitRSVP({
        event_id: event.id,
        guest_name: guestName,
        guest_count: guestCount,
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
      {loading ? <div className="invite-card invite-loading">Preparing your invitation…</div> : error && !event ? <div className="invite-card invite-error"><span className="event-card-icon"><DoorOpen size={20} /></span><h1>Invitation unavailable</h1><p>{error}</p></div> : event ? (
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
              <label>Your name<input required value={guestName} onChange={(e) => setGuestName(e.target.value)} /></label>
              <label>Response<select value={response} onChange={(e) => setResponse(e.target.value as typeof response)}><option value="accepted">Accept with pleasure</option><option value="maybe">Maybe</option><option value="declined">Unable to attend</option></select></label>
              {response !== 'declined' && <label>Number of guests<input type="number" min={1} max={20} step={1} required value={guestCount} onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value)))} /></label>}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [response, setResponse] = useState<'accepted' | 'maybe' | 'declined'>('accepted');
  const [guestName, setGuestName] = useState('');
  const [guestCount, setGuestCount] = useState(1);
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
      })
      .catch((cause) => setError(messageFrom(cause)))
      .finally(() => setLoading(false));
  }, [token]);

  const event = invitation?.event;
  const teacher = invitation?.teacher;
  const page = { ...defaultLandingPageConfig, ...(invitation?.landing_page_config ?? {}) };
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
        guest_count: guestCount,
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
    <main className="invite-screen festival-invite-screen">
      {loading ? <div className="invite-card invite-loading">Preparing your invitation…</div> : error && !invitation ? <div className="invite-card invite-error"><span className="event-card-icon"><DoorOpen size={20} /></span><h1>Invitation unavailable</h1><p>{error}</p></div> : invitation && event ? (
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
          <header className="festival-page-header">
            {logoUrl
              ? <img className="festival-logo" src={logoUrl} alt="University logo" />
              : <div className="festival-logo festival-logo-placeholder" aria-label="University logo">HDU</div>}
            <button className="festival-audio-toggle" type="button" onClick={() => void toggleMusic()} disabled={!page.music_url} aria-label={musicPlaying ? 'Pause background music' : 'Play background music'} title={page.music_url ? 'Toggle background music' : 'Upload background music from the invitation editor'}>
              {musicPlaying ? <Volume2 size={24} /> : <VolumeX size={24} />}
            </button>
          </header>
          <div className="festival-university-heading">{page.university_heading}</div>
          <h1 className="festival-main-title">{page.festival_title}</h1>
          <p className="festival-tagline">{page.tagline}</p>
          {error && <div className="festival-inline-error"><Notice tone="error">{error}</Notice></div>}
          <article className="festival-invite-card">
            <div className="festival-invite-badge">{page.invitation_badge}</div>
            <div className="festival-recipient">
              <h2>{guestHeading || 'Distinguished Guest'}</h2>
              {teacher?.department && <p>{teacher.department}</p>}
            </div>
            <p className="festival-letter">{invitation.letter_content || teacher?.personalized_message || `It is our great pleasure and highest honor to cordially invite you to celebrate the ${page.festival_title} at Hangzhou Dianzi University.`}</p>
            {Number.isFinite(eventTimestamp) && <section className="festival-countdown" aria-label={page.countdown_label}>
              <h3>⌛ {page.countdown_label}</h3>
              <div className="countdown-grid">
                {([
                  ['days', countdown.days],
                  ['hours', countdown.hours],
                  ['mins', countdown.minutes],
                  ['secs', countdown.seconds],
                ] as const).map(([label, value]) => (
                  <div className="countdown-unit" key={label}><strong>{String(value).padStart(2, '0')}</strong><span>{label}</span></div>
                ))}
              </div>
            </section>}
            <section className="festival-event-details">
              <div className="festival-detail-row">
                <span className="festival-detail-emoji">🗓️</span>
                <div><h3>Date &amp; Time</h3><p>{eventDateLabel || 'Date to be announced'}</p>{eventTimeLabel && <strong>Starts at {eventTimeLabel}</strong>}</div>
              </div>
              <div className="festival-detail-row">
                <span className="festival-detail-emoji">📍</span>
                <div><h3>Venue &amp; Location</h3><p>{page.venue_name || event.venue}</p>{page.venue_detail && <p className="festival-detail-muted">{page.venue_detail}</p>}<p className="festival-detail-muted">{page.address || event.address}</p></div>
              </div>
              <div className="festival-detail-row">
                <span className="festival-detail-emoji">👔</span>
                <div><h3>Dress Code</h3><p className="festival-detail-muted">{page.dress_code}</p></div>
              </div>
            </section>
            {submitted ? (
              <div className="submitted-state"><span className="success-check"><Check size={21} /></span><h2>Thank you for responding</h2><p>Your RSVP has been recorded. We look forward to seeing you.</p></div>
            ) : (
              <>
                <button className="festival-rsvp-cta" type="button" onClick={showRSVPForm}>🌸 Click Here to Confirm RSVP</button>
                {rsvpOpen && <div className="festival-rsvp-panel" ref={rsvpRef}>
                  <form className="form-stack rsvp-form" onSubmit={sendRSVP}>
                    <h2>Will you join us?</h2>
                    <label>Your name<input required value={guestName} onChange={(e) => setGuestName(e.target.value)} /></label>
                    <label>Response<select value={response} onChange={(e) => setResponse(e.target.value as typeof response)}><option value="accepted">Accept with pleasure</option><option value="maybe">Maybe</option><option value="declined">Unable to attend</option></select></label>
                    {response !== 'declined' && <label>Number of guests<input type="number" min={1} max={20} step={1} required value={guestCount} onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value)))} /></label>}
                    <button className="button button-primary button-wide" disabled={busy}>{busy ? 'Sending response…' : 'Send RSVP'}<Send size={16} /></button>
                  </form>
                </div>}
              </>
            )}
            <section className="festival-transport">
              <h3>🚇 Campus &amp; Transportation Guide (交通指南)</h3>
              <p><strong>Subway:</strong> {page.subway_guide}</p>
              <p><strong>Campus Gate:</strong> {page.campus_gate} {page.campus_gate_chinese && `(${page.campus_gate_chinese})`}</p>
              <div className="festival-map-links">
                {page.amap_url && <a href={page.amap_url} target="_blank" rel="noreferrer">📍 Open in AMAP (高德地图)</a>}
                {page.tencent_map_url && <a href={page.tencent_map_url} target="_blank" rel="noreferrer">🧭 Open in Tencent Map (腾讯地图)</a>}
              </div>
            </section>
            <footer className="festival-card-footer">
              <p>Organized by {page.organizer}</p>
              <p>Contact WeChat: <strong>{page.wechat}</strong> | Email: <a href={`mailto:${page.email}`}>{page.email}</a></p>
            </footer>
          </article>
          <a className="festival-admin-link" href="/admin/login">🔒 Committee Admin Portal</a>
        </>
      ) : null}
    </main>
  );
}

function Notice({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export default App;
