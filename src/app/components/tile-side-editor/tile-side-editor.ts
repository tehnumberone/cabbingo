import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TileSide } from '../../models/bingo';
import { DatabaseService, LibraryImage } from '../../services/database.service';
import { RulesEditor } from '../rules-editor/rules-editor';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']; // same list as the worker
const MAX_IMAGE = 1024 * 1024;
type ImageField = 'tileImg' | 'bossSrc';

// One tile side: used for the front of a tile and for its flipped side.
@Component({
  selector: 'app-tile-side-editor',
  imports: [FormsModule, RulesEditor],
  templateUrl: './tile-side-editor.html',
})
export class TileSideEditor {
  @Input({ required: true }) side!: TileSide;
  @Input({ required: true }) idPrefix!: string; // keeps input ids unique between the two sides
  readonly images: { field: ImageField; label: string }[] = [
    { field: 'tileImg', label: 'Tile icon' },
    { field: 'bossSrc', label: 'Boss preview' },
  ];
  newItem = '';
  uploading: Record<string, boolean> = {};
  imageError = '';
  pickingImage: ImageField | null = null;
  library?: LibraryImage[];

  constructor(private databaseService: DatabaseService) { }

  // Rules textarea keeps blank lines while typing; they are dropped on save.
  get rules(): string {
    return this.side.rules.join('\n');
  }

  set rules(text: string) {
    this.side.rules = text.split('\n');
  }

  addItem() {
    const name = this.newItem.trim();
    const items = (this.side.items ??= []);
    if (name && !items.some((i) => i.toLowerCase() === name.toLowerCase())) items.push(name);
    this.newItem = '';
  }

  removeItem(item: string) {
    this.side.items = this.side.items?.filter((i) => i !== item);
  }

  toggleLibrary(field: ImageField) {
    this.pickingImage = this.pickingImage === field ? null : field;
    this.imageError = '';
    if (this.pickingImage && !this.library) {
      this.databaseService.listImages().subscribe({
        next: (images) => (this.library = images),
        error: () => {
          this.pickingImage = null;
          this.imageError = 'Could not load uploaded images, please try again.';
        },
      });
    }
  }

  // Uploads say who uploaded them; links only exist because a board uses them.
  imageTitle(image: LibraryImage): string {
    const used = image.usedIn.map((b) => b.title).join(', ');
    return image.kind === 'upload' ? `Uploaded by ${image.owner}${used ? `, used in ${used}` : ''}` : `Linked image, used in ${used}`;
  }

  useImage(field: ImageField, url: string) {
    this.side[field] = url;
    this.pickingImage = null;
  }

  uploadImage(event: Event, field: ImageField) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.imageError = '';
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return void (this.imageError = 'Only png, jpeg, gif or webp images.');
    if (file.size > MAX_IMAGE) return void (this.imageError = 'Images must be under 1MB.');
    const side = this.side;
    this.uploading[field] = true;
    // ponytail: replaced or unused uploads stay in the images table; admins clean them up at /admin/images
    this.databaseService.uploadImage(file).subscribe({
      next: ({ url }) => {
        side[field] = url;
        this.uploading[field] = false;
        this.library = undefined; // reload next time so the new upload shows up
      },
      error: (e) => {
        this.uploading[field] = false;
        this.imageError = e?.error?.error ?? 'Upload failed, please try again.';
      },
    });
  }
}
