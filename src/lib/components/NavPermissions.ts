  import { CogOutline, ChartPieOutline, CalendarEditOutline, ProfileCardOutline, AwardOutline } from "flowbite-svelte-icons";

  const availableApps = {
    guests: {name: "Guests", label: "Guests", href: "/households", icon: ProfileCardOutline, subContent: ""},
    calendar: {name: "Calendar", label: "Calendar", href: "/event", icon: CalendarEditOutline, subContent: ""},
    volunteers: {name: "Volunteers", label: "Volunteers", href: "/volunteers", icon: AwardOutline, subContent: ""},
    reports: {name: "Reports", label: "Reports", href: "/reports", icon: ChartPieOutline, subContent: ""},
    admin: {name: "Admin", label: "Admin", href: "/admin", icon: CogOutline, subContent: ""},
    donors: {name: "Donors", label: "Donors", href: "/donors", icon: CogOutline, subContent: ""},
    inventory: {name: "Inventory", label: "Inventory", href: "/inventory", icon: CogOutline, subContent: ""},
  }

export function getPermittedApps(roles: string[] | null | undefined) {
    const apps = Array()
    if (roles?.includes("Guest Manager")) { apps.push(availableApps.guests) }
    if (roles?.includes("Guest Manager")) { apps.push(availableApps.calendar) }
    if (roles?.includes("Volunteer Manager")) { apps.push(availableApps.volunteers) }
    if (roles?.includes("Administrator")) { apps.push(availableApps.reports) }
    if (roles?.includes("Donor Manager")) { apps.push(availableApps.donors) }
    if (roles?.includes("Inventory Manager")) { apps.push(availableApps.inventory) }
    if (roles?.includes("Administrator")) { apps.push(availableApps.admin) }
    return apps
}
