import React from 'react';
import { useParams } from 'react-router-dom';

const ArticleDetailPage = () => {
  const { id } = useParams();
  return (
    <div>
      <h1>Article Detail Page</h1>
      <p>Article ID: {id}</p>
      <p>This is the detail view for an article.</p>
    </div>
  );
};

export default ArticleDetailPage;
