import ProgramForm from '@/components/ProgramForm';

export default function NewProgramPage() {
  return (
    <div>
      <h1>Thêm chương trình khuyến mãi</h1>
      <ProgramForm initial={null} isEdit={false} />
    </div>
  );
}
