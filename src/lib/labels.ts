import { HouseholdStatus, AppointmentBookingStatus, ClientIdentificationType, ClientRelationship, ServiceTime, DeliveryType, DatedRequestStatus} from '$prisma/browser';

export const householdStatusLabels = {
  	ACTIVE: 'Active',
  	INACTIVE: 'Inactive',
  	ARCHIVED: 'Archived',
} as const satisfies Record<HouseholdStatus, string>;
export const householdStatusOptions = Object.entries(householdStatusLabels).map(([value, name]) => ({ value, name }));

const appointmentBookingStatusLabels = {
  	ACTIVE: 'Active',
  	NO_SHOW: 'No Show',
  	CANCELLED: 'Cancelled',
    COMPLETE: 'Complete',
    PENDING: 'Pending',

} as const satisfies Record<AppointmentBookingStatus, string>;
export const appointmentBookingStatusOptions = Object.entries(appointmentBookingStatusLabels).map(([value, name]) => ({ value, name }));

const idTypeLabels = {
    DRIVERS_LICENSE: 'Drivers License',
    ID_CARD: 'ID Card',
    HEALTH_CARD: 'Health Card',
    BILL: 'Bill',
    OTHER: 'Other',
} as const satisfies Record<ClientIdentificationType, string>;
export const idTypeOptions = Object.entries(idTypeLabels).map(([value, name]) => ({ value, name }));

export const relationshipLabels = {
    PRIMARY: 'Primary',
    SPOUSE: 'Spouse',
    PARENT: 'Parent',
    CHILD: 'Child',
    GRANDPARENT: 'Grandparent',
    SIBLING: 'Sibling',
    OTHER: 'Other',
} as const satisfies Record<ClientRelationship, string>;
export const relationshipOptions = Object.entries(relationshipLabels).map(([value, name]) => ({ value, name }));

export const deliveryTypeLabels = {
  IN_PERSON: 'In Person',
  DELIVERY: 'Delivery',
  PICKUP: 'Pickup',
} as const satisfies Record<DeliveryType, string>;
export const deliveryTypeOptions = Object.entries(deliveryTypeLabels).map(([value, name]) => ({ value, name }));

export const servicdTimeLabels = {
  MONDAY_MORNING: 'Monday Morning',
  MONDAY_EVENING: 'Monday Evening',
  TUESDAY_MORNING: 'Tuesday Morning',
  TUESDAY_EVENING: 'Tuesday Evening',
  WEDNESDAY_MORNING: 'Wednesday Morning',
  WEDNESDAY_EVENING: 'Wednesday Evening',
  THURSDAY_MORNING: 'Thursday Morning',
  THURSDAY_EVENING: 'Thursday Evening',
  FRIDAY_MORNING: 'Friday Morning',
  FRIDAY_EVENING: 'Friday Evening',
} as const satisfies Record<ServiceTime, string>;
export const serviceTimeOptions = Object.entries(servicdTimeLabels).map(([value, name]) => ({ value, name }));

export const datedRequestLabels = {
    ACTIVE: 'Active',
    CLOSED: 'Closed',
} as const satisfies Record<DatedRequestStatus, string>;
export const datedRequestStatusOptions = Object.entries(datedRequestLabels).map(([value, name]) => ({ value, name }));
