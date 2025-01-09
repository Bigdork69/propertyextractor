export const validateRow = (address: string, postcode: string): { isValid: boolean; error?: string } => {
  if (!address) {
    return { isValid: false, error: "Missing address" };
  }
  if (!postcode) {
    return { isValid: false, error: "Missing or invalid postcode" };
  }
  return { isValid: true };
};

export const processExcelData = (jsonData: any[]) => {
  return jsonData.map(row => ({
    address: row['Address'] || row['ADDRESS'] || '',
    postcode: row['Post Code'] || row['POST CODE'] || row['Postcode'] || row['POSTCODE'] || '',
  })).filter(row => row.address || row.postcode);
};