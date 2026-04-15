import { configureStore } from '@reduxjs/toolkit';
import steerReducer from '../features/steer/store/steerSlice';
import skillReducer from '../features/skill/store/skillSlice';
import documentReducer from '../features/document/store/documentSlice';
import authReducer from '../shared/store/authSlice';

export const store = configureStore({
  reducer: {
    steer: steerReducer,
    skill: skillReducer,
    document: documentReducer,
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
