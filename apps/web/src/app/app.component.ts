import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NoteCardComponent } from './components/note-card/note-card.component';
import { NoteDialogComponent, NoteDialogData } from './components/note-dialog/note-dialog.component';
import { NoteService, Note, CreateNoteDto } from './services/note.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    NoteCardComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  notes: Note[] = [];
  loading = true;

  constructor(
    private noteService: NoteService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadNotes();
  }

  loadNotes(): void {
    this.loading = true;
    this.noteService.getNotes().subscribe({
      next: (notes) => {
        this.notes = notes;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load notes', err);
        this.showError('Could not load notes. Is the API running?');
        this.loading = false;
      },
    });
  }

  // Opens the dialog in create mode (data: null)
  openCreateDialog(): void {
    const dialogRef = this.dialog.open(NoteDialogComponent, {
      data: null as NoteDialogData,
      width: '500px',
      maxWidth: '95vw',
    });

    dialogRef.afterClosed().subscribe((result: CreateNoteDto | undefined) => {
      if (!result) return; // User cancelled
      this.noteService.createNote(result).subscribe({
        next: (note) => {
          this.notes = [note, ...this.notes]; // prepend so newest appears first
          this.showSuccess('Note created!');
        },
        error: () => this.showError('Failed to create note'),
      });
    });
  }

  // Opens the dialog in edit mode (data: the note to edit)
  openEditDialog(note: Note): void {
    const dialogRef = this.dialog.open(NoteDialogComponent, {
      data: note as NoteDialogData,
      width: '500px',
      maxWidth: '95vw',
    });

    dialogRef.afterClosed().subscribe((result: CreateNoteDto | undefined) => {
      if (!result) return; // User cancelled
      this.noteService.updateNote(note.id, result).subscribe({
        next: (updated) => {
          // Replace the old note in the array with the updated one
          this.notes = this.notes.map((n) => (n.id === updated.id ? updated : n));
          this.showSuccess('Note updated!');
        },
        error: () => this.showError('Failed to update note'),
      });
    });
  }

  deleteNote(id: string): void {
    this.noteService.deleteNote(id).subscribe({
      next: () => {
        // Remove from local array — triggers Angular's *ngFor to animate out
        this.notes = this.notes.filter((n) => n.id !== id);
        this.showSuccess('Note deleted');
      },
      error: () => this.showError('Failed to delete note'),
    });
  }

  // trackBy function for *ngFor — prevents Angular from re-rendering unchanged cards
  trackById(_index: number, note: Note): string {
    return note.id;
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'OK', { duration: 3000, panelClass: 'snack-success' });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Dismiss', { duration: 5000, panelClass: 'snack-error' });
  }
}
