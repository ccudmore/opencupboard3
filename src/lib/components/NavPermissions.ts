  import { CogOutline, ChartPieOutline, CalendarEditOutline, ProfileCardOutline, AwardOutline } from "flowbite-svelte-icons";
import { hasPermission } from '$lib/utils';

  const availableApps = {
    households: {name: "Houesholds and Guests", label: "Households and Guests", href: "/households", icon: ProfileCardOutline, subContent: ""},
    calendar: {name: "Calendar", label: "Calendar", href: "/calendar", icon: CalendarEditOutline, subContent: ""},
    volunteers: {name: "Manage Volunteers", label: "Manage Volunteers", href: "/volunteers", icon: AwardOutline, subContent: ""},
    reports: {name: "Reports", label: "Reports", href: "/reports", icon: ChartPieOutline, subContent: ""},
    admin: {name: "Admin", label: "Admin", href: "/admin", icon: CogOutline, subContent: ""},
    donors: {name: "Donors", label: "Donors", href: "/donors", icon: CogOutline, subContent: ""},
    inventory: {name: "Inventory", label: "Inventory", href: "/inventory", icon: CogOutline, subContent: ""},
    volunteer: {name: "Volunteer", label: "Volunteer", href: "/inventory", icon: CogOutline, subContent: ""},
  }

export function getPermittedApps(permissions: string[] | null | undefined,) {
    const apps = Array()
    if (hasPermission(permissions, ['manage-households'])) { apps.push(availableApps.households) }
    if (hasPermission(permissions, ['manage-appointments'])) { apps.push(availableApps.calendar) }
    if (hasPermission(permissions, ['manage-configuration'])) { apps.push(availableApps.admin) }
    if (hasPermission(permissions, ['manage-volunteers'])) { apps.push(availableApps.volunteers) }
    if (hasPermission(permissions, ['manage-inventory'])) { apps.push(availableApps.inventory) }
    if (hasPermission(permissions, ['manage-donors'])) { apps.push(availableApps.donors) }
    if (hasPermission(permissions, ['access-volunteer'])) { apps.push(availableApps.volunteer) }
    return apps
}