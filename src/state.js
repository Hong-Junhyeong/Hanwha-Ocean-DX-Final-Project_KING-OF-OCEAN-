const initialState = Object.freeze({
  currentPage: 'overview',
  selectedFacility: null,
  selectedBlock: null,
  yardView: 'ALL',
  viewerMode: 'YARD_OVERVIEW',
  issueCategory: 'ALL',
  selectedIssueId: null,
});

export function createStore() {
  let state = { ...initialState };
  const listeners = new Set();

  const notify = () => listeners.forEach((listener) => listener(state));

  return {
    getState: () => ({ ...state }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setPage(page) {
      state = { ...state, currentPage: page };
      notify();
    },
    selectFacility(facilityId) {
      state = {
        ...state,
        currentPage: 'overview',
        selectedFacility: facilityId,
        selectedBlock: null,
        yardView: 'ALL',
        viewerMode: 'YARD_OVERVIEW',
        issueCategory: 'ALL',
        selectedIssueId: null,
      };
      notify();
    },
    selectBlock(blockId) {
      state = {
        ...state,
        currentPage: 'overview',
        selectedFacility: 'B_ZONE',
        selectedBlock: blockId,
        yardView: 'ALL',
        viewerMode: blockId === 'B-203' && state.viewerMode === 'B203_DETAIL_3D'
          ? 'B203_DETAIL_3D'
          : 'YARD_OVERVIEW',
        issueCategory: 'ALL',
        selectedIssueId: null,
      };
      notify();
    },
    clearSelection() {
      state = { ...initialState, currentPage: 'overview' };
      notify();
    },
    setYardView(view) {
      if (view === 'ALL') {
        this.clearSelection();
      }
    },
    setViewerMode(mode) {
      const nextMode = mode === 'B203_DETAIL_3D' && state.selectedBlock === 'B-203'
        ? 'B203_DETAIL_3D'
        : 'YARD_OVERVIEW';
      state = { ...state, viewerMode: nextMode };
      notify();
    },
    setIssueCategory(category) {
      state = { ...state, issueCategory: category, selectedIssueId: null };
      notify();
    },
    selectIssue(issueId) {
      state = { ...state, selectedIssueId: issueId };
      notify();
    },
  };
}

export { initialState };
