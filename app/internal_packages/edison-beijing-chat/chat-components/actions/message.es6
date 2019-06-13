// Message management
export const BEGIN_FETCH_MESSAGE = 'BEGIN_FETCH_MESSAGE';
export const FETCH_NEXT_MESSAGE = 'FETCH_NEXT_MESSAGE';
export const SUCCESS_FETCH_MESSAGE = 'SUCCESS_FETCH_MESSAGE';
export const FAIL_FETCH_MESSAGE = 'FAIL_FETCH_MESSAGE';
export const FAIL_STORE_MESSAGE = 'FAIL_STORE_MESSAGE';

// Message management
export const fetchNextMessage = (payload) => ({ type: FETCH_NEXT_MESSAGE, payload });

export const succesfullyFetchedMessage = result => ({ type: SUCCESS_FETCH_MESSAGE, payload: result });

export const failedFetchingMessage = error => ({ type: FAIL_FETCH_MESSAGE, payload: error });

export const failedStoreMessage = error => ({ type: FAIL_STORE_MESSAGE, payload: error });
