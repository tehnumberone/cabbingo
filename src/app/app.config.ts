import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay, withNoHttpTransferCache } from '@angular/platform-browser';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { provideDatabase, getDatabase } from '@angular/fire/database'; // Changed from Firestore
import { environment } from './environments/environment';
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideRouter(routes),
    provideClientHydration(withEventReplay(), withNoHttpTransferCache()),
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideDatabase(() => getDatabase()),
  ]
};
