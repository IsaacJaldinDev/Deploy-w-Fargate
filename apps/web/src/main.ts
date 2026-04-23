import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Bootstrap the standalone Angular application.
// In Angular 17+ standalone mode, there is no AppModule — the app is bootstrapped
// directly with the root component and a configuration object (appConfig).
bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
