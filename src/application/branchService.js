export function createBranchService(store) {
  return {
    list() {
      return store.branches();
    },
  };
}
