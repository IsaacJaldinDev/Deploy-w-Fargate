import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// Note interface — mirrors the Sequelize model from apps/api/src/models/note.model.ts
// Both sides must agree on these field names for the app to work correctly
export interface Note {
  id: string;
  title: string;
  description: string;
  createdAt: string;   // ISO 8601 string — convert to Date in the template with DatePipe
  updatedAt: string;
}

export interface CreateNoteDto {
  title: string;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class NoteService {
  // Base URL switches automatically between development and production
  // based on which environment.ts file Angular compiled with.
  // In development: http://localhost:3000/notes
  // In production:  http://your-api-alb-dns/notes
  private readonly apiUrl = `${environment.apiBaseUrl}/notes`;

  constructor(private http: HttpClient) {}

  getNotes(): Observable<Note[]> {
    return this.http.get<Note[]>(this.apiUrl);
  }

  createNote(data: CreateNoteDto): Observable<Note> {
    return this.http.post<Note>(this.apiUrl, data);
  }

  updateNote(id: string, data: CreateNoteDto): Observable<Note> {
    return this.http.put<Note>(`${this.apiUrl}/${id}`, data);
  }

  deleteNote(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
