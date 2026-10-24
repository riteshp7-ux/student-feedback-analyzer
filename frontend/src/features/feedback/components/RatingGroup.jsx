import React from 'react';

const RATING_LEVELS = [
  { value: 1, label: '1 - Poor' },
  { value: 2, label: '2 - Fair' },
  { value: 3, label: '3 - Satisfactory' },
  { value: 4, label: '4 - Very Good' },
  { value: 5, label: '5 - Excellent' },
];

export default function RatingGroup({
  id,
  title,
  description,
  value,
  onChange,
  error,
}) {
  const describedBy = [description && `${id}-desc`, error && `${id}-error`]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <fieldset className={`rating-group ${error ? 'rating-group-invalid' : ''}`} aria-describedby={describedBy}>
      <legend id={`${id}-legend`} className="rating-legend">
        <span className="rating-title">{title}</span>
        <span className="required-indicator" aria-hidden="true"> *</span>
      </legend>
      {description && (
        <p id={`${id}-desc`} className="rating-description">
          {description}
        </p>
      )}

      <div className="rating-options" role="radiogroup" aria-labelledby={`${id}-legend`}>
        {RATING_LEVELS.map((level) => {
          const inputId = `${id}-${level.value}`;
          const isSelected = value === level.value;

          return (
            <label
              key={level.value}
              htmlFor={inputId}
              className={`rating-option-label ${isSelected ? 'is-selected' : ''}`}
            >
              <input
                type="radio"
                id={inputId}
                name={id}
                value={level.value}
                checked={isSelected}
                onChange={() => onChange(level.value)}
                className="rating-radio-input"
                aria-required="true"
                aria-label={level.label}
              />
              <span className="rating-number">{level.value}</span>
            </label>
          );
        })}
      </div>

      {error && (
        <div id={`${id}-error`} className="field-error-msg" role="alert">
          {error}
        </div>
      )}
    </fieldset>
  );
}
