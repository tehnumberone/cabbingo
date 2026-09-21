import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { DatabaseService } from './services/database.service';

describe('App', () => {
  let refreshUser: jasmine.Spy;

  beforeEach(async () => {
    refreshUser = jasmine.createSpy('refreshUser');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: DatabaseService, useValue: { refreshUser } }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // The shell is just a router outlet; every page lives behind it.
  it('renders the router outlet inside main', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('main router-outlet')).toBeTruthy();
  });

  // Restores the logged-in session on page load.
  it('refreshes the user on startup', () => {
    TestBed.createComponent(App);
    expect(refreshUser).toHaveBeenCalled();
  });
});
