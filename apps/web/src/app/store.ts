import { configureStore } from '@reduxjs/toolkit';
import documentReducer from '../features/document/store/documentSlice';
import authReducer from '../shared/store/authSlice';

export const store = configureStore({
  reducer: {
    document: documentReducer,
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
