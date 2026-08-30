import { useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  ArrowRight, BedDouble, CalendarDays, Check, ChevronLeft, CircleHelp,
  Clock3, Download, HeartHandshake, Loader2, MapPin, Minus, Plus,
  RotateCcw, Search, Send, ShieldCheck, Sparkles, Star, TicketCheck,
  Trash2, UsersRound, Utensils, Waves,
} from 'lucide-react';
import {
  getGetBookingsQueryKey, getGetListingsQueryKey, useCancelBooking,
  useCreateBooking, useGetBookings, useGetListings, useSendAssistantMessage,
} from '@workspace/api-client-react';
import type { Booking, Listing } from '@workspace/api-client-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

type ChatItem = { id: number; role: 'assistant' | 'user'; text: string };
type Details = { name: string; email: string; phone: string };

const starterMessages: ChatItem[] = [
  { id: 1, role: 'assistant', text: 'Good afternoon. I’m Mira, your stay concierge. Tell me where you’re headed and what would make the room feel right.' },
  { id: 2, role: 'assistant', text: 'I’ll keep the search focused, then stay with you through the booking.' },
];

const addOnOptions = [
  { id: 'breakfast', label: 'Breakfast for two', detail: 'A relaxed start, served until 11:00', price: 28, icon: Utensils },
  { id: 'transfer', label: 'Airport transfer', detail: 'A private car waiting on arrival', price: 54, icon: Waves },
  { id: 'flexible-cancel', label: 'Flexible cancellation', detail: 'Cancel until 48 hours before check-in', price: 34, icon: ShieldCheck },
];

function Home() {
  const [chat, setChat] = useState<ChatItem[]>(starterMessages);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState({ destination: '', checkIn: '', checkOut: '', guests: 2, maxPrice: '', amenity: '' });
  const [selected, setSelected] = useState<Listing | null>(null);
  const [addOns, setAddOns] = useState<string[]>([]);
  const [details, setDetails] = useState<Details>({ name: '', email: '', phone: '' });
  const [step, setStep] = useState<'search' | 'stay' | 'details' | 'confirmed'>('search');
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  const queryParams = useMemo(() => ({
    ...(search.destination ? { destination: search.destination } : {}),
    ...(search.checkIn ? { checkIn: search.checkIn } : {}),
    ...(search.checkOut ? { checkOut: search.checkOut } : {}),
    guests: search.guests,
    ...(search.maxPrice ? { maxPrice: Number(search.maxPrice) } : {}),
    ...(search.amenity ? { amenity: search.amenity } : {}),
  }), [search]);
  const listingsQuery = useGetListings(queryParams, { query: { queryKey: getGetListingsQueryKey(queryParams) } });
  const bookingsQuery = useGetBookings({ query: { queryKey: getGetBookingsQueryKey() } });
  const assistant = useSendAssistantMessage();
  const createBooking = useCreateBooking();
  const cancelBooking = useCancelBooking();
  const listings = listingsQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(''), 3200);
  };

  const resetSession = () => {
    setChat(starterMessages);
    setMessage('');
    setSearch({ destination: '', checkIn: '', checkOut: '', guests: 2, maxPrice: '', amenity: '' });
    setSelected(null);
    setAddOns([]);
    setDetails({ name: '', email: '', phone: '' });
    setStep('search');
    setFormError('');
    setConfirmedBooking(null);
    showToast('A fresh conversation is ready.');
  };

  const sendMessage = (text = message) => {
    const clean = text.trim();
    if (!clean || assistant.isPending) return;
    setChat((items) => [...items, { id: Date.now(), role: 'user', text: clean }]);
    setMessage('');
    assistant.mutate({ data: { message: clean, context: { ...search } } }, {
      onSuccess: (reply) => {
        setChat((items) => [...items, { id: Date.now() + 1, role: 'assistant', text: reply.message }]);
        const extracted = reply.extracted ?? {};
        const next = {
          destination: String(extracted.destination ?? extracted.city ?? search.destination),
          checkIn: String(extracted.checkIn ?? search.checkIn),
          checkOut: String(extracted.checkOut ?? search.checkOut),
          guests: Number(extracted.guests ?? search.guests) || 2,
          maxPrice: search.maxPrice,
          amenity: search.amenity,
        };
        setSearch(next);
        if (reply.suggestedListings?.length) showToast(`${reply.suggestedListings.length} stays found for you.`);
      },
      onError: () => setChat((items) => [...items, { id: Date.now() + 1, role: 'assistant', text: 'I couldn’t reach the desk just now. Please try that again, or use the search fields below.' }]),
    });
  };

  const chooseListing = (listing: Listing) => {
    setSelected(listing);
    setAddOns([]);
    setStep('stay');
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const proceedToDetails = () => {
    if (!search.checkIn || !search.checkOut) return setFormError('Add your check-in and check-out dates to continue.');
    if (new Date(search.checkOut) <= new Date(search.checkIn)) return setFormError('Check-out must be after check-in.');
    setFormError('');
    setStep('details');
  };

  const completeBooking = () => {
    if (!selected) return;
    if (details.name.trim().length < 2 || !details.email.includes('@') || details.phone.trim().length < 7) {
      setFormError('Please check your name, email, and phone number.');
      return;
    }
    setFormError('');
    createBooking.mutate({
      data: {
        listingId: selected.id,
        checkIn: search.checkIn,
        checkOut: search.checkOut,
        guests: search.guests,
        customerName: details.name,
        customerEmail: details.email,
        customerPhone: details.phone,
        addOns,
      },
    }, {
      onSuccess: (booking) => {
        setConfirmedBooking(booking);
        setStep('confirmed');
        bookingsQuery.refetch();
        showToast('Your stay is confirmed.');
      },
      onError: (error) => {
        const apiMessage = (error as { data?: { error?: string } })?.data?.error;
        setFormError(apiMessage ?? 'The reservation could not be completed. Please try again.');
      },
    });
  };

  const cancel = (reference: string) => {
    if (!window.confirm('Cancel this reservation?')) return;
    cancelBooking.mutate({ reference }, {
      onSuccess: () => { bookingsQuery.refetch(); showToast('Reservation cancelled.'); },
      onError: () => showToast('We could not cancel this reservation.'),
    });
  };

  const nights = search.checkIn && search.checkOut
    ? Math.max(1, Math.ceil((new Date(search.checkOut).getTime() - new Date(search.checkIn).getTime()) / 86400000))
    : 1;
  const selectedAddOnTotal = addOns.reduce((total, id) => total + (addOnOptions.find((item) => item.id === id)?.price ?? 0), 0);
  const estimate = selected ? selected.pricePerNight * nights + selectedAddOnTotal : 0;
  const latestBooking = bookings[0];

  return (
    <div className="noise min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-40 border-b border-[hsl(var(--border)/.7)] bg-[hsl(var(--background)/.92)] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <button data-testid="button-reset-session" onClick={resetSession} className="group flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-primary text-primary-foreground shadow-[4px_4px_0_hsl(var(--accent))] transition-transform group-hover:-translate-y-0.5"><BedDouble size={20} /></span>
            <span className="text-left"><span className="block font-display text-xl font-semibold leading-none tracking-[-.02em]">Morrow</span><span className="font-mono-brand text-[9px] uppercase tracking-[.22em] text-muted-foreground">stay, considered</span></span>
          </button>
          <div className="flex items-center gap-2 sm:gap-5">
            <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />Your private hotel desk</div>
            <button data-testid="button-reset-top" onClick={resetSession} className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary"><RotateCcw size={14} /> <span className="hidden sm:inline">Reset</span></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 pb-20 sm:px-8">
        <div className="grid gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12 lg:pt-12">
          <section className="min-w-0">
            <div className="mb-8 max-w-3xl animate-rise">
              <div className="mb-4 flex items-center gap-2 font-mono-brand text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent))]"><Sparkles size={14} /> The shorter way to a good stay</div>
              <h1 className="font-display text-[clamp(2.9rem,6vw,5.9rem)] font-semibold leading-[.96] tracking-[-.055em] text-primary">Tell us where.<br /><span className="text-foreground">We’ll take it from here.</span></h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">A calm, capable concierge for the nights you don’t have time to overthink. Share the shape of your trip and we’ll narrow the world down.</p>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,.72fr)]">
              <section className="overflow-hidden rounded-[24px] border border-border bg-card shadow-[0_20px_60px_rgba(24,67,61,.08)]">
                <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
                  <div><p className="font-mono-brand text-[10px] uppercase tracking-[.16em] text-muted-foreground">Your conversation</p><p className="mt-1 text-sm font-semibold">Mira is listening</p></div>
                  <span className="flex items-center gap-2 rounded-full bg-[hsl(var(--secondary))] px-3 py-1.5 text-[11px] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" /> Available now</span>
                </div>
                <div className="flex min-h-[330px] max-h-[460px] flex-col gap-4 overflow-y-auto p-5 sm:p-7">
                  {chat.map((item) => <div data-testid={`message-${item.id}`} key={item.id} className={`flex max-w-[88%] animate-rise ${item.role === 'user' ? 'ml-auto justify-end' : 'mr-auto'}`}><div className={item.role === 'user' ? 'rounded-[18px_18px_4px_18px] bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground' : 'rounded-[18px_18px_18px_4px] bg-secondary px-4 py-3 text-sm leading-6 text-secondary-foreground'}>{item.text}</div></div>)}
                  {assistant.isPending && <div data-testid="status-assistant-loading" className="mr-auto flex items-center gap-2 rounded-[18px_18px_18px_4px] bg-secondary px-4 py-3 text-sm text-muted-foreground"><span className="flex gap-1"><i className="h-1.5 w-1.5 rounded-full bg-primary" /><i className="h-1.5 w-1.5 rounded-full bg-primary" /><i className="h-1.5 w-1.5 rounded-full bg-primary" /></span> Mira is checking the desk</div>}
                </div>
                <div className="border-t border-border p-4 sm:p-5">
                  <form onSubmit={(event) => { event.preventDefault(); sendMessage(); }} className="flex items-center gap-2 rounded-[16px] border border-border bg-background p-2 pl-4 transition-colors focus-within:border-primary">
                    <input data-testid="input-assistant-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Try “three quiet nights in Lisbon”" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" />
                    <button data-testid="button-send-message" disabled={!message.trim() || assistant.isPending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-accent text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"><Send size={17} /></button>
                  </form>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['A design hotel in Lisbon', 'Quiet room, 2 guests', 'I need an airport transfer'].map((prompt) => <button data-testid={`button-prompt-${prompt.slice(0, 4)}`} key={prompt} onClick={() => sendMessage(prompt)} className="rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary">{prompt}</button>)}
                  </div>
                </div>
              </section>

              <SearchPanel search={search} setSearch={setSearch} onSubmit={() => { setFormError(''); document.getElementById('stays')?.scrollIntoView({ behavior: 'smooth' }); }} />
            </div>

            <section id="stays" className="mt-12 scroll-mt-24">
              <div className="mb-5 flex items-end justify-between gap-4"><div><p className="font-mono-brand text-[10px] uppercase tracking-[.16em] text-muted-foreground">The considered shortlist</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-[-.03em]">Stays with a point of view</h2></div><span className="hidden text-xs text-muted-foreground sm:block">{listings.length ? `${listings.length} places` : 'Searching your way'}</span></div>
              {listingsQuery.isLoading ? <ListingSkeleton /> : listingsQuery.isError ? <StateCard icon={CircleHelp} title="The shortlist is taking a moment" text="We couldn’t load the hotel desk. Try the search again." action="Try again" onClick={() => listingsQuery.refetch()} /> : listings.length === 0 && search.checkIn && search.checkOut ? <StateCard icon={CalendarDays} title="Those dates are fully spoken for" text="Try shifting your dates by a night or loosening the destination. Mira can help you find the next best window." action="Clear dates" onClick={() => setSearch({ ...search, checkIn: '', checkOut: '' })} /> : listings.length === 0 ? <StateCard icon={Search} title="Let’s make the first move" text="Tell Mira a destination, or use the search fields to start your shortlist." action="Reset conversation" onClick={resetSession} /> : <div className="grid gap-4 md:grid-cols-2">{listings.map((listing, index) => <ListingCard key={listing.id} listing={listing} index={index} onChoose={chooseListing} />)}</div>}
            </section>

            <BookingsPanel bookings={bookings} loading={bookingsQuery.isLoading} onCancel={cancel} onDownload={(booking) => downloadBooking(booking)} />
          </section>

          <aside className="lg:pt-[255px]">
            {step === 'search' && <DeskNote latestBooking={latestBooking} onOpen={() => latestBooking && document.getElementById(`booking-${latestBooking.reference}`)?.scrollIntoView({ behavior: 'smooth' })} />}
            {step === 'stay' && selected && <StayPanel listing={selected} search={search} addOns={addOns} setAddOns={setAddOns} estimate={estimate} nights={nights} error={formError} onBack={() => setStep('search')} onContinue={proceedToDetails} />}
            {step === 'details' && selected && <GuestPanel selected={selected} details={details} setDetails={setDetails} error={formError} pending={createBooking.isPending} onBack={() => setStep('stay')} onComplete={completeBooking} />}
            {step === 'confirmed' && <ConfirmationPanel booking={confirmedBooking ?? latestBooking} listing={selected} search={search} details={details} onReset={resetSession} onDownload={() => { const booking = confirmedBooking ?? latestBooking; if (booking) downloadBooking(booking); }} />}
          </aside>
        </div>
      </main>
      {toast && <div data-testid="status-toast" className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground shadow-xl animate-rise"><Check size={16} /> {toast}</div>}
    </div>
  );
}

function SearchPanel({ search, setSearch, onSubmit }: { search: typeof defaultSearch; setSearch: (v: typeof defaultSearch) => void; onSubmit: () => void }) {
  return <section className="rounded-[24px] bg-primary p-5 text-primary-foreground shadow-[0_20px_60px_rgba(24,67,61,.16)] sm:p-7">
    <div className="mb-6 flex items-start justify-between"><div><p className="font-mono-brand text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary-foreground)/.6)]">Shape your stay</p><h2 className="mt-2 font-display text-2xl font-semibold">A few useful details</h2></div><CalendarDays className="text-[hsl(var(--accent))]" size={23} /></div>
    <div className="space-y-3">
      <label className="block"><span className="mb-1.5 block text-[11px] text-[hsl(var(--primary-foreground)/.65)]">Destination</span><div className="flex items-center gap-2 rounded-[12px] border border-[hsl(var(--primary-foreground)/.22)] bg-[hsl(var(--primary-foreground)/.08)] px-3"><MapPin size={16} className="shrink-0 text-[hsl(var(--accent))]" /><input data-testid="input-destination" value={search.destination} onChange={(e) => setSearch({ ...search, destination: e.target.value })} placeholder="City or neighborhood" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-[hsl(var(--primary-foreground)/.45)]" /></div></label>
      <div className="grid grid-cols-2 gap-3"><label><span className="mb-1.5 block text-[11px] text-[hsl(var(--primary-foreground)/.65)]">Check in</span><input data-testid="input-check-in" type="date" value={search.checkIn} onChange={(e) => setSearch({ ...search, checkIn: e.target.value })} className="w-full rounded-[12px] border border-[hsl(var(--primary-foreground)/.22)] bg-[hsl(var(--primary-foreground)/.08)] px-3 py-3 text-xs outline-none [color-scheme:dark]" /></label><label><span className="mb-1.5 block text-[11px] text-[hsl(var(--primary-foreground)/.65)]">Check out</span><input data-testid="input-check-out" type="date" value={search.checkOut} onChange={(e) => setSearch({ ...search, checkOut: e.target.value })} className="w-full rounded-[12px] border border-[hsl(var(--primary-foreground)/.22)] bg-[hsl(var(--primary-foreground)/.08)] px-3 py-3 text-xs outline-none [color-scheme:dark]" /></label></div>
       <label className="block"><span className="mb-1.5 block text-[11px] text-[hsl(var(--primary-foreground)/.65)]">Guests</span><div className="flex items-center justify-between rounded-[12px] border border-[hsl(var(--primary-foreground)/.22)] bg-[hsl(var(--primary-foreground)/.08)] px-3 py-1"><span className="flex items-center gap-2 text-sm"><UsersRound size={16} className="text-[hsl(var(--accent))]" /> {search.guests} {search.guests === 1 ? 'guest' : 'guests'}</span><span className="flex items-center gap-1"><button data-testid="button-decrease-guests" type="button" onClick={() => setSearch({ ...search, guests: Math.max(1, search.guests - 1) })} className="rounded-lg p-2 hover:bg-[hsl(var(--primary-foreground)/.12)]"><Minus size={14} /></button><button data-testid="button-increase-guests" type="button" onClick={() => setSearch({ ...search, guests: Math.min(12, search.guests + 1) })} className="rounded-lg p-2 hover:bg-[hsl(var(--primary-foreground)/.12)]"><Plus size={14} /></button></span></div></label>
       <div className="grid grid-cols-2 gap-3">
         <label><span className="mb-1.5 block text-[11px] text-[hsl(var(--primary-foreground)/.65)]">Nightly budget</span><select data-testid="select-budget" value={search.maxPrice} onChange={(e) => setSearch({ ...search, maxPrice: e.target.value })} className="w-full rounded-[12px] border border-[hsl(var(--primary-foreground)/.22)] bg-[hsl(var(--primary-foreground)/.08)] px-3 py-3 text-xs outline-none"><option value="">Any budget</option><option value="180">Under $180</option><option value="240">Under $240</option><option value="300">Under $300</option></select></label>
         <label><span className="mb-1.5 block text-[11px] text-[hsl(var(--primary-foreground)/.65)]">Room feel</span><select data-testid="select-amenity" value={search.amenity} onChange={(e) => setSearch({ ...search, amenity: e.target.value })} className="w-full rounded-[12px] border border-[hsl(var(--primary-foreground)/.22)] bg-[hsl(var(--primary-foreground)/.08)] px-3 py-3 text-xs outline-none"><option value="">Any amenities</option><option value="breakfast">Breakfast</option><option value="workspace">Workspace</option><option value="airport shuttle">Airport shuttle</option><option value="pool">Pool</option></select></label>
       </div>
      <button data-testid="button-find-stays" type="button" onClick={onSubmit} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[12px] bg-accent py-3.5 text-sm font-bold text-accent-foreground transition-transform hover:-translate-y-0.5">Find my stay <ArrowRight size={16} /></button>
    </div>
    <p className="mt-4 flex items-center gap-2 text-[11px] text-[hsl(var(--primary-foreground)/.6)]"><ShieldCheck size={13} /> No account needed. No pressure to book.</p>
  </section>;
}

const defaultSearch = { destination: '', checkIn: '', checkOut: '', guests: 2, maxPrice: '', amenity: '' };

function ListingCard({ listing, index, onChoose }: { listing: Listing; index: number; onChoose: (listing: Listing) => void }) {
  return <article data-testid={`card-listing-${listing.id}`} className="group overflow-hidden rounded-[20px] border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-[hsl(var(--primary)/.4)] hover:shadow-[0_18px_40px_rgba(24,67,61,.11)]" style={{ animationDelay: `${index * 90}ms` }}>
    <div className="relative h-52 overflow-hidden bg-secondary">{listing.imageUrl ? <img data-testid={`img-listing-${listing.id}`} src={listing.imageUrl} alt={listing.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center bg-[linear-gradient(125deg,hsl(var(--primary)),hsl(var(--accent)))] text-primary-foreground"><BedDouble size={42} /></div>}<div className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1.5 font-mono-brand text-[10px] uppercase tracking-[.1em] text-primary">{listing.type}</div><div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1.5 text-xs text-primary-foreground"><Star size={12} fill="currentColor" /> {listing.rating.toFixed(1)}</div></div>
    <div className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-[21px] font-semibold leading-tight">{listing.name}</h3><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} /> {listing.city}, {listing.country}</p></div><span className="shrink-0 font-mono-brand text-[11px] text-muted-foreground">{listing.reviewCount} reviews</span></div><p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">{listing.description}</p><div className="mt-4 flex flex-wrap gap-1.5">{listing.amenities.slice(0, 3).map((amenity) => <span key={amenity} className="rounded-full bg-secondary px-2.5 py-1 text-[10px] text-secondary-foreground">{amenity}</span>)}</div><div className="mt-5 flex items-end justify-between border-t border-border pt-4"><div><span className="font-display text-xl font-semibold">${listing.pricePerNight}</span><span className="text-xs text-muted-foreground"> / night</span></div><button data-testid={`button-choose-listing-${listing.id}`} onClick={() => onChoose(listing)} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-transform group-hover:translate-x-0.5">View stay <ArrowRight size={14} /></button></div></div>
  </article>;
}

function ListingSkeleton() {
  return <div className="grid gap-4 md:grid-cols-2">{[1, 2].map((item) => <div key={item} className="overflow-hidden rounded-[20px] border border-border bg-card"><div className="skeleton h-52" /><div className="space-y-4 p-5"><div className="skeleton h-5 w-2/3 rounded" /><div className="skeleton h-3 w-1/3 rounded" /><div className="skeleton h-10 w-full rounded" /><div className="skeleton h-8 w-full rounded" /></div></div>)}</div>;
}

function StateCard({ icon: Icon, title, text, action, onClick }: { icon: typeof Search; title: string; text: string; action: string; onClick: () => void }) {
  return <div data-testid="state-listings" className="flex flex-col items-center rounded-[20px] border border-dashed border-border bg-card px-6 py-14 text-center"><span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary"><Icon size={21} /></span><h3 className="font-display text-xl font-semibold">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{text}</p><button data-testid="button-state-action" onClick={onClick} className="mt-5 rounded-full border border-primary px-4 py-2 text-xs font-bold text-primary hover:bg-secondary">{action}</button></div>;
}

function DeskNote({ latestBooking, onOpen }: { latestBooking?: Booking; onOpen: () => void }) {
  return <div className="rounded-[22px] border border-[hsl(var(--accent)/.45)] bg-[hsl(var(--accent)/.1)] p-6"><div className="mb-7 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground"><HeartHandshake size={21} /></div><p className="font-mono-brand text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">A note from the desk</p><h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-primary">Good stays start with less noise.</h2><p className="mt-4 text-sm leading-6 text-foreground/70">We look at the details that change how a night feels: the light, the bed, the walk home. Your shortlist is intentionally small.</p>{latestBooking && <button data-testid="button-open-booking-note" onClick={onOpen} className="mt-6 flex items-center gap-2 text-xs font-bold text-primary">View your latest reservation <ArrowRight size={14} /></button>}<div className="mt-8 border-t border-[hsl(var(--accent)/.28)] pt-4 text-xs text-foreground/55">Mira is here whenever the trip takes shape.</div></div>;
}

function StayPanel({ listing, search, addOns, setAddOns, estimate, nights, error, onBack, onContinue }: { listing: Listing; search: typeof defaultSearch; addOns: string[]; setAddOns: (v: string[]) => void; estimate: number; nights: number; error: string; onBack: () => void; onContinue: () => void }) {
  const toggle = (id: string) => setAddOns(addOns.includes(id) ? addOns.filter((item) => item !== id) : [...addOns, id]);
  return <div className="animate-rise rounded-[22px] border border-border bg-card p-5 shadow-[0_15px_40px_rgba(24,67,61,.08)] sm:p-6"><button data-testid="button-back-to-listings" onClick={onBack} className="mb-5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><ChevronLeft size={14} /> Back to shortlist</button><div className="flex items-start justify-between gap-3"><div><p className="font-mono-brand text-[10px] uppercase tracking-[.14em] text-accent">Your room</p><h2 data-testid="text-selected-listing" className="mt-1 font-display text-2xl font-semibold leading-tight">{listing.name}</h2><p className="mt-1 text-xs text-muted-foreground">{listing.roomLabel} · {listing.maxGuests} guests max</p></div><div className="text-right"><p className="font-display text-2xl font-semibold">${listing.pricePerNight}</p><p className="text-[10px] text-muted-foreground">per night</p></div></div><div className="mt-6 grid grid-cols-2 gap-2"><div className="rounded-[12px] bg-secondary p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Dates</p><p className="mt-1 text-xs font-semibold">{search.checkIn || 'Select date'} <span className="text-muted-foreground">→</span> {search.checkOut || 'Select date'}</p></div><div className="rounded-[12px] bg-secondary p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Guests</p><p className="mt-1 text-xs font-semibold">{search.guests} {search.guests === 1 ? 'guest' : 'guests'} · {nights} {nights === 1 ? 'night' : 'nights'}</p></div></div><div className="mt-7"><p className="mb-3 text-sm font-semibold">Make it yours <span className="font-normal text-muted-foreground">(optional)</span></p><div className="space-y-2">{addOnOptions.map(({ id, label, detail, price, icon: Icon }) => <button data-testid={`button-addon-${id}`} key={id} onClick={() => toggle(id)} className={`flex w-full items-center gap-3 rounded-[13px] border p-3 text-left transition-colors ${addOns.includes(id) ? 'border-primary bg-[hsl(var(--secondary))]' : 'border-border hover:border-primary/50'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${addOns.includes(id) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary'}`}><Icon size={15} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{label}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{detail}</span></span><span className="font-mono-brand text-[10px]">+${price}</span>{addOns.includes(id) && <Check size={14} className="text-primary" />}</button>)}</div></div>{error && <p data-testid="status-booking-validation" className="mt-4 rounded-lg bg-[hsl(var(--destructive)/.1)] p-3 text-xs text-destructive">{error}</p>}<div className="mt-6 flex items-end justify-between border-t border-border pt-5"><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Estimated total</p><p data-testid="text-estimated-total" className="mt-1 font-display text-2xl font-semibold">${estimate.toFixed(2)}</p></div><button data-testid="button-continue-details" onClick={onContinue} className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-xs font-bold text-primary-foreground">Guest details <ArrowRight size={14} /></button></div></div>;
}

function GuestPanel({ selected, details, setDetails, error, pending, onBack, onComplete }: { selected: Listing; details: Details; setDetails: (v: Details) => void; error: string; pending: boolean; onBack: () => void; onComplete: () => void }) {
  return <div className="animate-rise rounded-[22px] border border-border bg-card p-5 shadow-[0_15px_40px_rgba(24,67,61,.08)] sm:p-6"><button data-testid="button-back-to-stay" onClick={onBack} className="mb-5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><ChevronLeft size={14} /> Back to stay</button><p className="font-mono-brand text-[10px] uppercase tracking-[.14em] text-accent">One last detail</p><h2 className="mt-2 font-display text-3xl font-semibold leading-tight">Who should the desk expect?</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">We’ll send the confirmation to you and let {selected.name} know you’re on your way.</p><div className="mt-7 space-y-4"><Field label="Full name" value={details.name} placeholder="Your name" testId="input-guest-name" onChange={(name) => setDetails({ ...details, name })} /><Field label="Email address" value={details.email} placeholder="you@example.com" testId="input-guest-email" onChange={(email) => setDetails({ ...details, email })} type="email" /><Field label="Mobile number" value={details.phone} placeholder="+1 555 000 0000" testId="input-guest-phone" onChange={(phone) => setDetails({ ...details, phone })} type="tel" /></div><div className="mt-6 flex items-center gap-2 rounded-[12px] bg-secondary p-3 text-xs text-muted-foreground"><ShieldCheck size={15} className="text-primary" /> Secure checkout simulation · no card is charged</div>{error && <p data-testid="status-details-validation" className="mt-4 rounded-lg bg-[hsl(var(--destructive)/.1)] p-3 text-xs text-destructive">{error}</p>}<button data-testid="button-confirm-booking" onClick={onComplete} disabled={pending} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-sm font-bold text-accent-foreground disabled:opacity-60">{pending ? <><Loader2 size={16} className="animate-spin" /> Securing your room</> : <>Confirm and reserve <TicketCheck size={16} /></>}</button></div>;
}

function Field({ label, value, placeholder, testId, onChange, type = 'text' }: { label: string; value: string; placeholder: string; testId: string; onChange: (v: string) => void; type?: string }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold">{label}</span><input data-testid={testId} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full rounded-[12px] border border-border bg-background px-3.5 py-3 text-sm outline-none transition-colors focus:border-primary placeholder:text-muted-foreground" /></label>;
}

function ConfirmationPanel({ booking, listing, search, details, onReset, onDownload }: { booking?: Booking; listing: Listing | null; search: typeof defaultSearch; details: Details; onReset: () => void; onDownload: () => void }) {
  return <div data-testid="panel-confirmation" className="animate-rise overflow-hidden rounded-[22px] bg-primary text-primary-foreground shadow-[0_18px_45px_rgba(24,67,61,.2)]"><div className="relative p-6 sm:p-7"><div className="absolute -right-8 -top-10 h-36 w-36 rounded-full border-[18px] border-[hsl(var(--accent)/.4)]" /><span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground"><Check size={24} /></span><p className="mt-7 font-mono-brand text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary-foreground)/.6)]">It’s all arranged</p><h2 className="mt-2 font-display text-3xl font-semibold leading-tight">Your room is waiting.</h2><p className="mt-3 text-sm leading-6 text-[hsl(var(--primary-foreground)/.72)]">A confirmation is on its way to {details.email || 'your inbox'}.</p><div className="mt-7 rounded-[15px] bg-[hsl(var(--primary-foreground)/.1)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{booking?.listing.name ?? listing?.name}</p><p className="mt-1 text-xs text-[hsl(var(--primary-foreground)/.65)]">{search.checkIn} → {search.checkOut} · {search.guests} guests</p></div><span data-testid="text-booking-reference" className="font-mono-brand text-[10px] text-[hsl(var(--accent))]">{booking?.reference ?? 'PENDING'}</span></div></div>{booking && <div data-testid="invoice-breakdown" className="mt-4 rounded-[15px] bg-[hsl(var(--primary-foreground)/.06)] px-4 py-3 text-xs"><div className="flex justify-between py-1.5 text-[hsl(var(--primary-foreground)/.68)]"><span>Room & add-ons</span><span>${booking.subtotal.toFixed(2)}</span></div><div className="flex justify-between py-1.5 text-[hsl(var(--primary-foreground)/.68)]"><span>Taxes</span><span>${booking.taxes.toFixed(2)}</span></div><div className="flex justify-between py-1.5 text-[hsl(var(--primary-foreground)/.68)]"><span>Service fees</span><span>${booking.fees.toFixed(2)}</span></div><div className="mt-2 flex justify-between border-t border-[hsl(var(--primary-foreground)/.2)] pt-3 font-semibold"><span>Total</span><span className="font-display text-lg">${booking.total.toFixed(2)}</span></div></div>}<div className="mt-6 flex gap-2"><button data-testid="button-download-confirmation" onClick={onDownload} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent py-3 text-xs font-bold text-accent-foreground"><Download size={14} /> Download</button><button data-testid="button-new-search" onClick={onReset} className="flex items-center justify-center gap-2 rounded-full border border-[hsl(var(--primary-foreground)/.3)] px-4 py-3 text-xs font-bold text-primary-foreground hover:bg-[hsl(var(--primary-foreground)/.1)]"><Search size={14} /> New stay</button></div></div></div>;
}

function BookingsPanel({ bookings, loading, onCancel, onDownload }: { bookings: Booking[]; loading: boolean; onCancel: (reference: string) => void; onDownload: (booking: Booking) => void }) {
  return <section className="mt-14 border-t border-border pt-10"><div className="mb-5 flex items-end justify-between"><div><p className="font-mono-brand text-[10px] uppercase tracking-[.16em] text-muted-foreground">Your trips</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-[-.03em]">The desk remembers</h2></div><Clock3 size={20} className="text-accent" /></div>{loading ? <div className="skeleton h-24 rounded-[16px]" /> : bookings.length === 0 ? <div data-testid="empty-bookings" className="rounded-[17px] border border-dashed border-border bg-card px-5 py-8 text-center"><p className="text-sm font-semibold">No reservations yet</p><p className="mt-1 text-xs text-muted-foreground">Your confirmed stays will settle here.</p></div> : <div className="space-y-3">{bookings.map((booking) => <div data-testid={`card-booking-${booking.reference}`} id={`booking-${booking.reference}`} key={booking.reference} className="flex flex-col gap-4 rounded-[17px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-secondary text-primary"><BedDouble size={18} /></div><div><p className="font-semibold">{booking.listing.name}</p><p className="mt-1 text-xs text-muted-foreground">{booking.checkIn} → {booking.checkOut} · {booking.nights} nights</p><p className="mt-2 font-mono-brand text-[10px] text-primary">{booking.reference} · <span className="uppercase">{booking.status}</span></p></div></div><div className="flex items-center gap-2 sm:justify-end"><span className="mr-auto font-display text-xl font-semibold sm:mr-3">${booking.total.toFixed(2)}</span><button data-testid={`button-download-booking-${booking.reference}`} onClick={() => onDownload(booking)} className="rounded-full border border-border p-2.5 text-muted-foreground hover:text-primary"><Download size={15} /></button>{booking.status.toLowerCase() !== 'cancelled' && <button data-testid={`button-cancel-booking-${booking.reference}`} onClick={() => onCancel(booking.reference)} className="rounded-full border border-[hsl(var(--destructive)/.35)] p-2.5 text-destructive hover:bg-[hsl(var(--destructive)/.08)]"><Trash2 size={15} /></button>}</div></div>)}</div>}</section>;
}

function downloadBooking(booking: Booking) {
  const body = [`MORROW / STAY CONFIRMATION`, ``, `Reference: ${booking.reference}`, `${booking.listing.name}`, `${booking.listing.city}, ${booking.listing.country}`, ``, `Check-in: ${booking.checkIn}`, `Check-out: ${booking.checkOut}`, `Guests: ${booking.guests}`, `Guest: ${booking.customerName}`, ``, `Total: $${booking.total.toFixed(2)}`, `Status: ${booking.status}`].join('\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url; link.download = `morrow-${booking.reference}.txt`; link.click(); URL.revokeObjectURL(url);
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
