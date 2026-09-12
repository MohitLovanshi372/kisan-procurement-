export interface GatePassData {
  procurementId?: string;
  tokenNumber: string;
  gatePassNumber: string;
  gatePassStatus: string;
  gatePassPassedAt: string;
  assignedGate: string;
  farmerName: string;
  farmerMobile: string;
  farmerVillage: string;
  farmerId: string;
  crop: string;
  quantity: string;
  receivedQuantity?: string;
  centre: string;
  scheduleDate: string;
  timeSlot: string;
  status: string;
  officerName: string;
  verifiedAt: string;
}

export interface VerifyTokenResponse {
  success: boolean;
  valid: boolean;
  passedGatePass?: boolean;
  message: string;
  gatePassNumber?: string;
  gatePassStatus?: string;
  gatePassPassedAt?: string;
  assignedGate?: string;
  officerName?: string;
  centreName?: string;
  isCentreMismatch?: boolean;
  tokenCentre?: string;
  officerCentre?: string;
  data?: GatePassData;
}

export interface OfficerInfo {
  name: string;
  mobile: string;
  officerId: string;
  role: string;
  assignedCentreId?: string;
  assignedCentreName?: string;
}

export interface ScannerScanResult {
  code: string;
  timestamp: string;
  source: 'camera' | 'upload' | 'manual' | 'demo';
}
