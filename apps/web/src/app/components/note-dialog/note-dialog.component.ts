import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { NgIf } from '@angular/common';
import { Note } from '../../services/note.service';

// Data shape injected into the dialog by the parent component.
// null means we're creating a new note.
// A Note object means we're editing an existing one.
export type NoteDialogData = Note | null;

@Component({
  selector: 'app-note-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgIf,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './note-dialog.component.html',
  styleUrl: './note-dialog.component.scss',
})
export class NoteDialogComponent implements OnInit {
  form!: FormGroup;

  // Whether we're in edit mode (true) or create mode (false)
  get isEditing(): boolean {
    return this.data !== null;
  }

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<NoteDialogComponent>,
    // MAT_DIALOG_DATA is the injection token for data passed to MatDialog.open()
    // The parent component passes Note | null via the `data` option
    @Inject(MAT_DIALOG_DATA) public data: NoteDialogData,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      // Pre-populate fields with existing note data in edit mode
      title: [
        this.data?.title ?? '',
        [Validators.required, Validators.maxLength(120)],
      ],
      description: [
        this.data?.description ?? '',
        [Validators.required],
      ],
    });
  }

  save(): void {
    if (this.form.valid) {
      // Close the dialog and pass the form values back to the caller
      // The parent component receives this in the afterClosed() observable
      this.dialogRef.close(this.form.value);
    } else {
      // Mark all fields as touched so validation errors become visible
      this.form.markAllAsTouched();
    }
  }

  cancel(): void {
    // Close without passing any data — the parent's afterClosed() gets undefined
    this.dialogRef.close();
  }
}
