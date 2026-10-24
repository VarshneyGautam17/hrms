import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Users, CalendarCheck2, Wallet, ReceiptText, History, Settings, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import logoUrl from '../assets/deepak-electricals-logo.jpg';

const NAV_ITEMS = [
  { to: '/', label: 'Attendance', end: true, icon: CalendarCheck2, color: 'text-emerald-300' },
  { to: '/employees', label: 'Employees', icon: Users, color: 'text-sky-300' },
  { to: '/advances', label: 'Advances', icon: Wallet, color: 'text-amber-300' },
  { to: '/salary', label: 'Salary & Records', icon: ReceiptText, color: 'text-fuchsia-300' },
  { to: '/history', label: 'History', icon: History, color: 'text-teal-300' },
  { to: '/settings', label: 'Settings', icon: Settings, color: 'text-indigo-200' },
];

/** Sidebar links. Lives inside SidebarProvider so it can close the mobile drawer once a page is picked. */
function NavMenu({ pathname }: { pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      {NAV_ITEMS.map((item) => {
        const isActive = item.end ? pathname === item.to : pathname.startsWith(item.to);
        return (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton
              isActive={isActive}
              tooltip={item.label}
              render={<NavLink to={item.to} end={item.end} />}
              onClick={() => isMobile && setOpenMobile(false)}
              className={cn(
                'text-indigo-100 hover:bg-white/10 hover:text-white data-active:bg-white/15 data-active:text-white data-active:shadow-sm',
                // Icons read small at the default size-4; size up while expanded, but keep the collapsed
                // icon rail at size-4 since that's an exact fit for its fixed 32px button box.
                '[&_svg]:size-5 group-data-[collapsible=icon]:[&_svg]:size-4!',
              )}
            >
              <item.icon className={cn(item.color)} />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

/** Toggles between light and dark theme. Reads the resolved theme only after mount, since next-themes can't know it until then. */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="ml-auto"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {mounted ? isDark ? <Sun /> : <Moon /> : null}
    </Button>
  );
}

export function Layout() {
  const { pathname } = useLocation();

  return (
    <SidebarProvider>
      <Sidebar
        collapsible="icon"
        className="no-print [&>div>[data-slot=sidebar-inner]]:bg-gradient-to-b [&>div>[data-slot=sidebar-inner]]:from-indigo-600 [&>div>[data-slot=sidebar-inner]]:to-violet-800"
      >
        <SidebarHeader className="border-b border-white/10">
          <div className="flex items-center gap-3 rounded-xl bg-white/10 px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <img
              src={logoUrl}
              alt="Deepak Electricals"
              className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain p-1 shadow-md ring-2 ring-white/40 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:p-0.5"
            />
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold text-white">Deepak Electricals</p>
              <p className="truncate text-xs text-indigo-200">Attendance &amp; Salary</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <NavMenu pathname={pathname} />
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1 size-10 [&_svg]:size-6!" aria-label="Open or close menu" />
          <Separator orientation="vertical" className="h-14" />
          <img
            src={logoUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded-md bg-white object-contain p-0.5 shadow-sm ring-1 ring-border"
          />
          <p className="truncate text-sm font-semibold">Deepak Electricals</p>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-x-hidden p-4 sm:p-5 md:p-6 lg:p-8 print:p-0">
          <div key={pathname} className="animate-in fade-in-0 slide-in-from-bottom-1 mx-auto w-full max-w-7xl duration-300">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
