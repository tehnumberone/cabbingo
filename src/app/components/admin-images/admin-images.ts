import { DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DatabaseService, LibraryImage } from '../../services/database.service';
import { SessionService } from '../../services/session-service';

@Component({
  selector: 'app-admin-images',
  imports: [DatePipe, DecimalPipe, RouterModule],
  templateUrl: './admin-images.html',
})
export class AdminImages implements OnInit {
  images?: LibraryImage[];
  errorMessage = '';
  deleting: Record<string, boolean> = {};

  constructor(
    private databaseService: DatabaseService,
    public sessionService: SessionService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.sessionService.user?.isAdmin) return;
    this.databaseService.listImages().subscribe({
      next: (images) => (this.images = images.filter((i) => i.kind === 'upload')), // links live in boards, nothing to delete
      error: () => (this.errorMessage = 'Could not load images, please try again later.'),
    });
  }

  delete(image: LibraryImage) {
    const used = image.usedIn.length
      ? `It is used in ${image.usedIn.map((b) => b.title).join(', ')}; those tiles will show no image. `
      : '';
    if (!confirm(`Delete this image? ${used}This cannot be undone.`)) return;
    this.errorMessage = '';
    this.deleting[image.id!] = true;
    this.databaseService.deleteImage(image.id!).subscribe({
      next: () => (this.images = this.images?.filter((i) => i !== image)),
      error: (e) => {
        this.deleting[image.id!] = false;
        this.errorMessage = e?.error?.error ?? 'Deleting failed, please try again.';
      },
    });
  }
}
