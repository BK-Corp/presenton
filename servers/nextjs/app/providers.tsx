'use client';

import { Provider } from 'react-redux';
import { store } from '../store/store';
import ChatGptAuthRedirectHandler from './ChatGptAuthRedirectHandler';
import { LanguageProvider } from '@/lib/i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>
    <LanguageProvider>
      <ChatGptAuthRedirectHandler />
      {children}
    </LanguageProvider>
  </Provider>;
}
