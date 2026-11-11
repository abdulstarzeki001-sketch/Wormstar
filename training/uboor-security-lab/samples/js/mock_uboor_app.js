// Entirely synthetic educational fixture. No working credentials or remote calls.
const ownerStore = { companyOwnerToken: "OWNER_FAKE" };
const mainUser = { token: "GLOBAL_FAKE" };
const axiosMock = { interceptors: { request: { use: function(fn) { return fn; } } } };
axiosMock.interceptors.request.use((request) => {
  if (mainUser.token) request.headers.Authorization = "Bearer " + mainUser.token;
  return request;
});
const endpoints = [
  "local_form/company_item_reduce",
  "local_form/read_doc_company",
  "local_form/return_company_doc"
];
const examplePayload = { item1: { production_capacity: 1.9 }, vihcle_info: { weight_quantity: "1.9" } };
const localStorage = { getItem: () => null, setItem: () => {} };
console.debug("TEST ONLY: no credential", examplePayload.item1.production_capacity);
