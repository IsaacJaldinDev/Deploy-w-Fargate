import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DatePipe, NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { trigger, transition, style, animate } from '@angular/animations';
import { Note } from '../../services/note.service';

@Component({
  selector: 'app-note-card',
  standalone: true,
  imports: [
    DatePipe,
    NgIf,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './note-card.component.html',
  styleUrl: './note-card.component.scss',
  animations: [
    trigger('cardAnimation', [
      // Card enters: fade in + slide up from 20px below
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      // Card leaves: fade out + shrink slightly
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'scale(0.95) translateY(-8px)' })),
      ]),
    ]),
  ],
})
export class NoteCardComponent {
  // required: true (Angular 17+) — the parent MUST pass a note; TypeScript will
  // warn at compile time if the binding is missing
  @Input({ required: true }) note!: Note;

  // Events emitted to the parent (AppComponent) when user clicks edit or delete
  @Output() editNote = new EventEmitter<Note>();
  @Output() deleteNote = new EventEmitter<string>();

  onEdit(): void {
    this.editNote.emit(this.note);
  }

  onDelete(): void {
    this.deleteNote.emit(this.note.id);
  }
}
