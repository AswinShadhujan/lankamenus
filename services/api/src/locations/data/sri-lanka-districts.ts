/**
 * Official 25 districts of Sri Lanka (for filters and reference).
 * App is limited to Sri Lanka per product scope.
 */
export interface DistrictDto {
  id: string;
  name: string;
}

export const SRI_LANKA_DISTRICTS: DistrictDto[] = [
  { id: 'ampara', name: 'Ampara' },
  { id: 'anuradhapura', name: 'Anuradhapura' },
  { id: 'badulla', name: 'Badulla' },
  { id: 'batticaloa', name: 'Batticaloa' },
  { id: 'colombo', name: 'Colombo' },
  { id: 'galle', name: 'Galle' },
  { id: 'gampaha', name: 'Gampaha' },
  { id: 'hambantota', name: 'Hambantota' },
  { id: 'jaffna', name: 'Jaffna' },
  { id: 'kalutara', name: 'Kalutara' },
  { id: 'kandy', name: 'Kandy' },
  { id: 'kegalle', name: 'Kegalle' },
  { id: 'kilinochchi', name: 'Kilinochchi' },
  { id: 'kurunegala', name: 'Kurunegala' },
  { id: 'mannar', name: 'Mannar' },
  { id: 'matale', name: 'Matale' },
  { id: 'matara', name: 'Matara' },
  { id: 'monaragala', name: 'Monaragala' },
  { id: 'mullaitivu', name: 'Mullaitivu' },
  { id: 'nuwara-eliya', name: 'Nuwara Eliya' },
  { id: 'polonnaruwa', name: 'Polonnaruwa' },
  { id: 'puttalam', name: 'Puttalam' },
  { id: 'ratnapura', name: 'Ratnapura' },
  { id: 'trincomalee', name: 'Trincomalee' },
  { id: 'vavuniya', name: 'Vavuniya' },
];
