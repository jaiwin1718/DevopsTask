{{/*
_helpers.tpl — reusable snippets included across all templates.

{{ include "learningdemo.labels" . }} injects the same standard labels into
every resource so kubectl selectors and ArgoCD's UI can group them cleanly.
*/}}

{{/* Common labels applied to every resource */}}
{{- define "learningdemo.labels" -}}
app.kubernetes.io/name: learningdemo
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
