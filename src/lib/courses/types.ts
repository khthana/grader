export interface CourseKey {
  code: string
  year: number
  semester: number
}

export interface CourseRecord extends CourseKey {
  nameTh: string
  nameEn: string
  program: string | null
  language: string
  createdAt: string
}
