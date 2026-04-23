import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

// Angular 17+ standalone app configuration (replaces AppModule)
// All providers are registered here and available throughout the app.
export const appConfig: ApplicationConfig = {
  providers: [
    // Required for all HTTP calls in NoteService (HttpClient injection)
    provideHttpClient(),

    // Required for Angular Material components — enables CSS animations.
    // The async variant lazy-loads the animation module for a smaller initial bundle.
    provideAnimationsAsync(),
  ],
};
