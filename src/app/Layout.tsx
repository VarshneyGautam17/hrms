import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Users, CalendarCheck2, Wallet, ReceiptText, Settings } from 'lucide-react';
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

const NAV_ITEMS = [
  { to: '/', label: 'Attendance', end: true, icon: CalendarCheck2, color: 'text-emerald-300' },
  { to: '/employees', label: 'Employees', icon: Users, color: 'text-sky-300' },
  { to: '/advances', label: 'Advances', icon: Wallet, color: 'text-amber-300' },
  { to: '/salary', label: 'Salary & Records', icon: ReceiptText, color: 'text-fuchsia-300' },
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

export function Layout() {
  const { pathname } = useLocation();

  return (
    <SidebarProvider>
      <Sidebar
        collapsible="icon"
        className="no-print [&>div>[data-slot=sidebar-inner]]:bg-gradient-to-b [&>div>[data-slot=sidebar-inner]]:from-indigo-600 [&>div>[data-slot=sidebar-inner]]:to-violet-800"
      >
        <SidebarHeader>
          <div className="flex items-center gap-2.5 px-1 py-1">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-sm font-bold text-white shadow-sm ring-1 ring-white/20">
              DE
            </span>
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
          <Separator orientation="vertical" className="h-6" />
          <p className="truncate text-sm font-medium">Deepak Electricals</p>
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
