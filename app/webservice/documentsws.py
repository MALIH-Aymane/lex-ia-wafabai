from flask import Blueprint, jsonify, request
from utils.extensions import db
from models.document import Document, Langue, StatusEnum
from datetime import datetime
import traceback

document_ws = Blueprint('documents', __name__)

# -----------------------------------------------------------
# Create a new document
# -----------------------------------------------------------
@document_ws.route('/documents', methods=['POST'])
def create_document():
    try:
        data = request.get_json()
        name = data.get('name')
        type_ = data.get('type')
        langue = data.get('langue')
        date_str = data.get('date')
        status = data.get('status')
        ishidden = data.get('ishidden', False)
        full_path = data.get('full_path')  # 🆕 new field

        # Validate and parse enums / date
        langue_enum = Langue[langue.upper()] if isinstance(langue, str) else langue
        status_enum = StatusEnum[status.upper()] if isinstance(status, str) else status
        date_val = datetime.strptime(date_str, '%Y-%m-%d').date() if isinstance(date_str, str) else date_str

        document = Document(
            name=name,
            type=type_,
            langue=langue_enum,
            date=date_val,
            status=status_enum,
            ishidden=ishidden,
            full_path=full_path
        )

        db.session.add(document)
        db.session.commit()

        return jsonify({
            'message': 'Document created successfully',
            'document': document.as_dict()
        }), 201

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 400


@document_ws.route('/documents/groupings', methods=['GET'])
def get_all_document_groupings():
    """
    Get all unique grouping names present in SQL documents or ChromaDB.
    """
    try:
        sql_groupings = db.session.query(Document.grouping).filter(
            Document.grouping != None, Document.grouping != ''
        ).distinct().all()
        result_set = set([g[0] for g in sql_groupings if g[0]])

        # Fallback to ChromaDB groupings if needed
        try:
            from utils.chroma_client_manager import get_chroma_client
            client = get_chroma_client()
            for col in client.list_collections():
                try:
                    sample = col.get(limit=200, include=['metadatas'])
                    for meta in sample.get('metadatas', []):
                        if meta and meta.get('grouping'):
                            val = str(meta['grouping']).strip()
                            if val:
                                result_set.add(val)
                except Exception:
                    pass
        except Exception:
            pass

        return jsonify({'groupings': sorted(list(result_set))}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@document_ws.route('/documents', methods=['GET'])
def get_all_documents():
    try:
        # --- Extract filter params ---
        status = request.args.get('status')           # e.g., "active"
        langue = request.args.get('langue')           # e.g., "fr"
        type_ = request.args.get('type')              # e.g., "pdf"
        name = request.args.get('name')               # partial match
        grouping = request.args.get('grouping')       # grouping filter
        collection_name = request.args.get('collection_name') # collection filter
        from_date = request.args.get('from_date')     # e.g., "2024-01-01"
        to_date = request.args.get('to_date')         # e.g., "2024-12-31"
        include_hidden = request.args.get('include_hidden', 'false').lower() == 'true'

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)

        # --- Start base query ---
        query = Document.query

        # --- Visibility filter ---
        if not include_hidden:
            query = query.filter_by(ishidden=False)

        # --- Enum filters ---
        if status:
            try:
                query = query.filter(Document.status == StatusEnum[status.upper()])
            except KeyError:
                return jsonify({'error': f"Invalid status '{status}'"}), 400

        if langue:
            try:
                query = query.filter(Document.langue == Langue[langue.upper()])
            except KeyError:
                return jsonify({'error': f"Invalid langue '{langue}'"}), 400

        # Ensure columns exist in database
        try:
            db.session.execute(db.text("ALTER TABLE documents ADD COLUMN grouping VARCHAR(255) NULL"))
            db.session.execute(db.text("ALTER TABLE documents ADD COLUMN collection_name VARCHAR(255) NULL"))
            db.session.commit()
        except Exception:
            db.session.rollback()

        # --- Other filters ---
        if type_:
            query = query.filter(Document.type.ilike(f"%{type_}%"))
        if name:
            query = query.filter(Document.name.ilike(f"%{name}%"))
        if grouping:
            try:
                query = query.filter(Document.grouping.ilike(f"%{grouping}%"))
            except Exception:
                pass
        if collection_name:
            try:
                query = query.filter(Document.collection_name.ilike(f"%{collection_name}%"))
            except Exception:
                pass

        # --- Date range filters ---
        from datetime import datetime
        if from_date:
            from_date_obj = datetime.strptime(from_date, '%Y-%m-%d').date()
            query = query.filter(Document.date >= from_date_obj)
        if to_date:
            to_date_obj = datetime.strptime(to_date, '%Y-%m-%d').date()
            query = query.filter(Document.date <= to_date_obj)

        total_items = query.count()

        # --- Execute paginated query ---
        query_ordered = query.order_by(Document.date.desc())
        
        if per_page > 0:
            query_ordered = query_ordered.offset((page - 1) * per_page).limit(per_page)

        documents = query_ordered.all()
        serialized_documents = [doc.as_dict() for doc in documents]

        import math
        total_pages = math.ceil(total_items / per_page) if per_page > 0 else 1

        return jsonify({
            'count': len(serialized_documents),
            'total_items': total_items,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages,
            'filters_applied': {
                'status': status,
                'langue': langue,
                'type': type_,
                'name': name,
                'grouping': grouping,
                'from_date': from_date,
                'to_date': to_date,
                'include_hidden': include_hidden
            },
            'documents': serialized_documents
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500



# -----------------------------------------------------------
# Get only active documents
# -----------------------------------------------------------
@document_ws.route('/documents/active', methods=['GET'])
def get_active_documents():
    try:
        active_documents = Document.query.filter_by(
            status=StatusEnum.ACTIVE,
            ishidden=False
        ).all()
        serialized_documents = [doc.as_dict() for doc in active_documents]
        return jsonify({'documents': serialized_documents}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# -----------------------------------------------------------
# Get one document by ID
# -----------------------------------------------------------
@document_ws.route('/documents/<int:document_id>', methods=['GET'])
def get_document(document_id):
    document = Document.query.get_or_404(document_id)
    return jsonify({'document': document.as_dict()}), 200


def rename_document_in_chromadb(old_name, new_name, doc_uuid=None, collection_name=None):
    """
    Renames a document across ChromaDB vector collections by updating metadatas for matching vectors.
    """
    from utils.chroma_client_manager import get_chroma_client, get_chroma_collection
    client = get_chroma_client()
    updated_count = 0

    collections_to_check = []
    if collection_name:
        try:
            collections_to_check.append(get_chroma_collection(collection_name))
        except Exception:
            pass

    if not collections_to_check:
        try:
            all_cols = client.list_collections()
            collections_to_check = all_cols
        except Exception as e:
            print(f"[WARN] Error listing ChromaDB collections during rename: {e}")

    for col in collections_to_check:
        try:
            res = None
            if doc_uuid:
                try:
                    res = col.get(where={"document_uuid": str(doc_uuid)}, include=["metadatas"])
                except Exception:
                    pass

            if not res or not res.get('ids'):
                try:
                    res = col.get(where={"reference": old_name}, include=["metadatas"])
                except Exception:
                    pass

            if not res or not res.get('ids'):
                continue

            ids = res.get('ids', [])
            metadatas = res.get('metadatas', [])

            ids_to_update = []
            metas_to_update = []

            for idx in range(len(ids)):
                item_id = ids[idx]
                meta = dict(metadatas[idx]) if idx < len(metadatas) and metadatas[idx] else {}

                modified = False
                if meta.get('reference') == old_name or meta.get('reference') is None:
                    meta['reference'] = new_name
                    modified = True

                if meta.get('levelvalue5') == old_name:
                    meta['levelvalue5'] = new_name
                    modified = True

                if meta.get('document') == old_name:
                    meta['document'] = new_name
                    modified = True

                if meta.get('doc_name') == old_name:
                    meta['doc_name'] = new_name
                    modified = True

                if modified:
                    ids_to_update.append(item_id)
                    metas_to_update.append(meta)

            if ids_to_update:
                col.update(ids=ids_to_update, metadatas=metas_to_update)
                updated_count += len(ids_to_update)
                print(f"[INFO] Updated {len(ids_to_update)} vector chunks in ChromaDB collection '{col.name}' for renamed doc '{old_name}' -> '{new_name}'")

        except Exception as ce:
            print(f"[WARN] Error updating collection {getattr(col, 'name', 'unknown')}: {ce}")

    return updated_count


@document_ws.route('/documents/<int:document_id>/rename', methods=['PUT', 'POST'])
def rename_document(document_id):
    """
    Rename a document in SQL and update all its vector metadata in ChromaDB.
    """
    try:
        doc = Document.query.get_or_404(document_id)
        data = request.get_json() or {}
        new_name = (data.get('new_name') or data.get('name') or '').strip()

        if not new_name:
            return jsonify({'error': 'Le nouveau nom du document est obligatoire.'}), 400

        old_name = doc.name
        if old_name == new_name:
            return jsonify({'message': 'Le nom reste inchangé.', 'document': doc.as_dict(), 'updated_vectors': 0}), 200

        # Update SQL
        doc.name = new_name
        db.session.commit()

        # Rename in ChromaDB collections
        updated_vector_count = rename_document_in_chromadb(
            old_name=old_name,
            new_name=new_name,
            doc_uuid=doc.uuid,
            collection_name=getattr(doc, 'collection_name', None)
        )

        return jsonify({
            'message': f'Document "{old_name}" renommé en "{new_name}" dans la base SQL et {updated_vector_count} vecteur(s) dans ChromaDB.',
            'document': doc.as_dict(),
            'old_name': old_name,
            'new_name': new_name,
            'updated_vectors': updated_vector_count
        }), 200

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# -----------------------------------------------------------
# Update a document
# -----------------------------------------------------------
@document_ws.route('/documents/<int:document_id>', methods=['PUT'])
def update_document(document_id):
    try:
        document = Document.query.get_or_404(document_id)
        data = request.get_json() or {}
        old_name = document.name
        new_name = data.get('name')

        # Update fields
        if new_name:
            document.name = new_name.strip()
        document.type = data.get('type', document.type)
        document.full_path = data.get('full_path', document.full_path)
        document.ishidden = data.get('ishidden', document.ishidden)

        # Handle enums and date safely
        if 'langue' in data:
            langue = data['langue']
            document.langue = Langue[langue.upper()] if isinstance(langue, str) else langue

        if 'status' in data:
            status = data['status']
            document.status = StatusEnum[status.upper()] if isinstance(status, str) else status

        if 'date' in data:
            date_val = data['date']
            if isinstance(date_val, str):
                date_val = datetime.strptime(date_val, '%Y-%m-%d').date()
            document.date = date_val

        db.session.commit()

        updated_vectors = 0
        if new_name and new_name.strip() != old_name:
            updated_vectors = rename_document_in_chromadb(
                old_name=old_name,
                new_name=new_name.strip(),
                doc_uuid=document.uuid,
                collection_name=getattr(document, 'collection_name', None)
            )

        return jsonify({
            'message': 'Document updated successfully',
            'document': document.as_dict(),
            'updated_vectors': updated_vectors
        }), 200

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({'error': str(e)}), 400


# -----------------------------------------------------------
# Soft delete a document
# -----------------------------------------------------------
@document_ws.route('/documents/<int:document_id>', methods=['DELETE'])
def delete_document(document_id):
    try:
        document = Document.query.get_or_404(document_id)
        document.ishidden = True
        
        # Cascade delete matching vectors from ChromaDB
        try:
            from utils.chroma_client_manager import get_chroma_client
            client = get_chroma_client()
            for col in client.list_collections():
                try:
                    col.delete(where={"document_uuid": document.uuid})
                except Exception:
                    pass
        except Exception as ve:
            print(f"Error deleting ChromaDB vectors for document uuid {document.uuid}: {ve}")

        db.session.commit()
        return jsonify({'message': 'Document deleted successfully'}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@document_ws.route('/documents/<int:document_id>/hide', methods=['PATCH'])
def hide_document(document_id):
    """
    Hide (soft-delete) a document by setting ishidden = True
    """
    try:
        document = Document.query.get_or_404(document_id)

        if document.ishidden:
            return jsonify({
                "message": f"Document '{document.name}' is already hidden.",
                "document": document.as_dict()
            }), 200

        document.ishidden = True
        db.session.commit()

        return jsonify({
            "message": f"Document '{document.name}' has been successfully hidden.",
            "document": document.as_dict()
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


from uuid import uuid4
import pandas as pd
import io
from utils.chroma_client_manager import get_chroma_collection
from utils.transformers_model_manager import get_sentence_transformer_model

def clean_str(val) -> str:
    """
    Convert any value to a clean string representation.
    Removes trailing '.0' from float integers (e.g. 2.0 -> "2", 15.0 -> "15").
    """
    if pd.isna(val) or val is None:
        return ""
    if isinstance(val, float):
        if val.is_integer():
            return str(int(val))
        return str(val)
    val_str = str(val).strip()
    if val_str.endswith(".0") and val_str[:-2].isdigit():
        return val_str[:-2]
    return val_str


@document_ws.route('/documents/upload_csv', methods=['POST'])
def upload_csv_to_collection():
    try:
        # Check if file is in request
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in the request'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        collection_name = request.form.get('collection_name', 'loi-maroc-2025').strip()
        group_value = request.form.get('group_value', '').strip()
        
        # Mapping parameters
        content_cols_str = request.form.get('content_columns', '').strip()
        display_content_col = request.form.get('display_content_column', '').strip().lower()
        doc_col = request.form.get('document_column', '').strip().lower()
        doc_url_col = request.form.get('document_url_column', '').strip().lower()
        pages_col = request.form.get('pages_column', '').strip().lower()

        if not collection_name:
            return jsonify({'error': 'collection_name is required'}), 400

        # Read CSV file
        filename = file.filename
        file_bytes = file.read()
        
        # Auto-detect delimiter from the first line of bytes
        try:
            first_line = file_bytes.split(b'\n')[0].decode('utf-8-sig', errors='ignore').replace('\r', '')
        except Exception:
            first_line = ""
            
        delimiter = ';' if ';' in first_line else ('\t' if '\t' in first_line else ',')
        
        df = pd.read_csv(io.BytesIO(file_bytes), sep=delimiter, encoding='utf-8-sig')
        df.columns = [c.strip().lower().replace('\r', '').replace('"', '').replace("'", "") for c in df.columns]

        print("[UPLOAD] Columns:", list(df.columns), "| delimiter:", repr(delimiter))

        if not group_value:
            import os
            group_value = os.path.splitext(filename)[0]

        # Parse content columns list (used for embedding / vector text)
        content_columns = [c.strip().lower() for c in content_cols_str.split(',') if c.strip()] if content_cols_str else []

        # Pre-process unique documents in the selected doc_col to register them in SQL
        unique_docs = []
        if doc_col in df.columns:
            unique_docs = [clean_str(x) for x in df[doc_col].dropna().unique() if clean_str(x)]
        
        if not unique_docs:
            unique_docs = [group_value]

        # Ensure grouping column exists in database
        try:
            db.session.execute(db.text("ALTER TABLE documents ADD COLUMN grouping VARCHAR(255) NULL"))
            db.session.commit()
        except Exception:
            db.session.rollback()

        # Map document name to a generated SQL Document entry and its UUID
        doc_uuid_map = {}
        for d_name in unique_docs:
            doc_record = None
            try:
                doc_record = Document.query.filter_by(name=d_name, full_path=filename).first()
            except Exception:
                db.session.rollback()

            if not doc_record:
                doc_record = Document(
                    name=d_name,
                    type="csv",
                    langue=Langue.FR,
                    date=datetime.utcnow().date(),
                    status=StatusEnum.ACTIVE,
                    ishidden=False,
                    full_path=filename
                )
                try:
                    doc_record.grouping = group_value
                    doc_record.collection_name = collection_name
                except Exception:
                    pass
                db.session.add(doc_record)
            else:
                try:
                    doc_record.grouping = group_value
                    doc_record.collection_name = collection_name
                except Exception:
                    pass
            
            try:
                db.session.flush()
            except Exception:
                db.session.rollback()

            doc_uuid_map[d_name] = getattr(doc_record, 'uuid', str(uuid4()))

        paragraphs = []
        ids = []
        metadatas = []

        # Look up embedding model from SQL DB Collection
        col_record = VectorCollection.query.filter_by(name=collection_name).first()
        model_path = col_record.embedding_model if col_record else "google/embeddinggemma-300m"

        model = get_sentence_transformer_model(model_path)

        for index, row in df.iterrows():
            # Build content text by combining selected columns or fallback
            if content_columns:
                text_parts = []
                for col in content_columns:
                    val = row.get(col)
                    clean_v = clean_str(val)
                    if clean_v:
                        text_parts.append(f"{col.upper()}: {clean_v}")
                text = " | ".join(text_parts).strip()
            else:
                text = clean_str(row.get('contenu') or row.get('paragraph') or row.get('content'))

            if not text:
                continue

            doc_id = str(uuid4())
            
            # Map metadata columns dynamically with clean string conversion
            mapped_doc = clean_str(row.get(doc_col)) if doc_col in row and pd.notna(row.get(doc_col)) else group_value
            mapped_doc_url = clean_str(row.get(doc_url_col)) if doc_url_col in row and pd.notna(row.get(doc_url_col)) else ''
            mapped_pages = clean_str(row.get(pages_col)) if pages_col in row and pd.notna(row.get(pages_col)) else ''

            # Get unique document uuid for this row
            row_doc_uuid = doc_uuid_map.get(mapped_doc, doc_uuid_map.get(group_value))

            # Display content: a separate column shown in search results (not used for embedding)
            if display_content_col and display_content_col in row and pd.notna(row.get(display_content_col)):
                display_text = clean_str(row.get(display_content_col))
            else:
                display_text = text  # fallback: same as vector text

            meta = {
                "grouping": clean_str(group_value),
                "document_uuid": str(row_doc_uuid),
                "reference": mapped_doc,
                "paragraph": text,         # vector text (embedded)
                "contenu": display_text,    # visible text shown in search results
                "collection": collection_name,
                "document_url": mapped_doc_url,
                "hyperlink": mapped_doc_url,
                "pages": mapped_pages,
            }

            # Map the 6 levels of title names & column values
            for i in range(1, 7):
                levelname_val = request.form.get(f"levelname_{i}", "").strip()
                levelvalue_col = request.form.get(f"levelvalue_{i}", "").strip().lower()

                if levelname_val:
                    meta[f"levelname{i}"] = levelname_val
                if levelvalue_col in row and pd.notna(row.get(levelvalue_col)):
                    meta[f"levelvalue{i}"] = clean_str(row.get(levelvalue_col))

            # Make levelvalue5 default to document name and levelvalue6 default to article number for compatibility
            if "levelvalue5" not in meta:
                meta["levelvalue5"] = mapped_doc
            if "levelname5" not in meta:
                meta["levelname5"] = "Document"

            safe_meta = {k: v for k, v in meta.items() if v != '' and v is not None}

            ids.append(doc_id)
            paragraphs.append(text)
            metadatas.append(safe_meta)

        if not ids:
            return jsonify({'error': 'No valid rows with content found in CSV file'}), 400

        # Generate embeddings
        embedded_vectors = model.encode(paragraphs).tolist()

        # Insert to ChromaDB
        collection = get_chroma_collection(collection_name)
        
        # Batch insert to prevent ChromaDB sizing errors
        batch_size = 100
        for i in range(0, len(ids), batch_size):
            collection.add(
                ids=ids[i:i+batch_size],
                embeddings=embedded_vectors[i:i+batch_size],
                metadatas=metadatas[i:i+batch_size]
            )

        db.session.commit()

        return jsonify({
            'message': f'Successfully indexed {len(ids)} paragraphs for {len(unique_docs)} unique documents into collection {collection_name}',
            'unique_documents': list(doc_uuid_map.keys()),
            'paragraphs_count': len(ids)
        }), 201

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ChromaDB Management Routes
@document_ws.route('/db/collections', methods=['GET'])
def get_db_collections():
    try:
        from utils.chroma_client_manager import get_chroma_client
        client = get_chroma_client()
        collections = client.list_collections()
        
        result = []
        for col in collections:
            result.append({
                'name': col.name,
                'metadata': col.metadata,
                'count': col.count()
            })
        return jsonify({'collections': result}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def _parse_metadata_where(metadata_filters) -> dict | None:
    """
    Converts list of {"key": k, "value": v} or dict {k: v} into a valid ChromaDB where clause.
    """
    if not metadata_filters:
        return None

    conds = []
    if isinstance(metadata_filters, list):
        for f in metadata_filters:
            if isinstance(f, dict) and f.get('key') and f.get('value') is not None and str(f.get('value')).strip():
                conds.append({f['key']: {"$eq": str(f['value']).strip()}})
    elif isinstance(metadata_filters, dict):
        for k, v in metadata_filters.items():
            if k and v is not None and str(v).strip():
                conds.append({k: {"$eq": str(v).strip()}})

    if not conds:
        return None
    if len(conds) == 1:
        return conds[0]
    return {"$and": conds}


@document_ws.route('/db/collections/<name>/metadata_keys', methods=['GET'])
def get_collection_metadata_keys(name):
    """
    Get all unique metadata keys and distinct values for a collection.
    """
    try:
        from utils.chroma_client_manager import get_chroma_collection
        collection = get_chroma_collection(name)

        sample = collection.get(limit=300, include=['metadatas'])
        metadatas = sample.get('metadatas', [])

        keys_dict = {}
        for meta in metadatas:
            if not meta:
                continue
            for k, v in meta.items():
                if k not in keys_dict:
                    keys_dict[k] = set()
                if v is not None and str(v).strip():
                    keys_dict[k].add(str(v).strip())

        result = {}
        for k, val_set in keys_dict.items():
            result[k] = sorted(list(val_set))[:50]

        return jsonify({
            'collection_name': name,
            'metadata_keys': sorted(list(keys_dict.keys())),
            'distinct_values': result
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@document_ws.route('/db/collections/<name>/peek', methods=['GET', 'POST'])
def peek_collection(name):
    try:
        from utils.chroma_client_manager import get_chroma_collection
        collection = get_chroma_collection(name)
        limit = request.args.get('limit', 50, type=int)

        where_clause = None
        if request.method == 'POST':
            data = request.get_json() or {}
            filters = data.get('filters') or data.get('metadata_filters')
            where_clause = _parse_metadata_where(filters)
            if data.get('limit'):
                limit = int(data.get('limit'))

        get_kwargs = {'limit': limit, 'include': ['documents', 'metadatas']}
        if where_clause:
            get_kwargs['where'] = where_clause

        peek_data = collection.get(**get_kwargs)

        result = []
        ids = peek_data.get('ids', [])
        metadatas = peek_data.get('metadatas', [])
        documents = peek_data.get('documents', [])

        for idx in range(len(ids)):
            result.append({
                'id': ids[idx],
                'metadata': metadatas[idx] if idx < len(metadatas) else {},
                'document': documents[idx] if idx < len(documents) else ''
            })

        return jsonify({
            'collection_name': name,
            'count': len(result),
            'total_count': collection.count(),
            'records': result
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@document_ws.route('/db/collections/<name>', methods=['DELETE'])
def delete_db_collection(name):
    """
    Delete ChromaDB collection and CASCADE DELETE all associated SQL Document records.
    """
    try:
        from utils.chroma_client_manager import get_chroma_client
        client = get_chroma_client()

        # 1. Delete ChromaDB vector collection
        try:
            client.delete_collection(name)
        except Exception as ce:
            print(f"[WARN] ChromaDB collection {name} delete warning: {ce}")

        # 2. Delete VectorCollection record in SQL
        col_record = VectorCollection.query.filter_by(name=name).first()
        if col_record:
            db.session.delete(col_record)

        # 3. CASCADE DELETE all matching SQL Document records indexed under this collection
        deleted_count = 0
        try:
            docs_to_delete = Document.query.filter_by(collection_name=name).all()
            deleted_count = len(docs_to_delete)
            for d in docs_to_delete:
                db.session.delete(d)
        except Exception as de:
            print(f"[WARN] Error deleting SQL Document records for collection {name}: {de}")

        db.session.commit()

        return jsonify({
            'message': f'Collection {name} et ses {deleted_count} document(s) associés ont été supprimés avec succès (cascade).',
            'deleted_documents_count': deleted_count
        }), 200
    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@document_ws.route('/vector-collections/<int:col_id>', methods=['DELETE'])
def delete_vector_collection_by_id(col_id):
    """
    Delete VectorCollection by SQL ID and CASCADE DELETE all associated SQL Document records.
    """
    try:
        col_record = VectorCollection.query.get_or_404(col_id)
        col_name = col_record.name

        from utils.chroma_client_manager import get_chroma_client
        client = get_chroma_client()
        try:
            client.delete_collection(col_name)
        except Exception:
            pass

        deleted_count = 0
        try:
            docs_to_delete = Document.query.filter_by(collection_name=col_name).all()
            deleted_count = len(docs_to_delete)
            for d in docs_to_delete:
                db.session.delete(d)
        except Exception:
            pass

        db.session.delete(col_record)
        db.session.commit()

        return jsonify({
            'message': f'Collection {col_name} et {deleted_count} document(s) associés supprimés avec succès (cascade).'
        }), 200
    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@document_ws.route('/db/collections/<name>/records/<record_id>', methods=['DELETE'])
def delete_db_record(name, record_id):
    try:
        from utils.chroma_client_manager import get_chroma_collection
        collection = get_chroma_collection(name)
        collection.delete(ids=[record_id])
        return jsonify({'message': f'Record {record_id} deleted successfully from {name}'}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@document_ws.route('/db/collections/<name>/query', methods=['POST'])
def query_db_collection(name):
    """
    Search vector collection by query text using SentenceTransformer embeddings.
    """
    try:
        data = request.get_json() or {}
        query_text = (data.get('query') or data.get('q') or '').strip()
        limit = int(data.get('limit', 20))
        filters = data.get('filters') or data.get('metadata_filters')
        where_clause = _parse_metadata_where(filters)

        if not query_text:
            return jsonify({'error': 'Missing query parameter'}), 400

        from utils.chroma_client_manager import get_chroma_collection
        from utils.transformers_model_manager import get_sentence_transformer_model

        collection = get_chroma_collection(name)
        model = get_sentence_transformer_model()

        # Generate 384-dim query vector
        query_embedding = model.encode(query_text).tolist()

        query_kwargs = {
            'query_embeddings': [query_embedding],
            'n_results': min(limit, collection.count() or 1),
            'include': ['documents', 'metadatas', 'distances']
        }
        if where_clause:
            query_kwargs['where'] = where_clause

        # Query ChromaDB for top-K vectors
        chroma_res = collection.query(**query_kwargs)

        ids = chroma_res.get('ids', [[]])[0]
        documents = chroma_res.get('documents', [[]])[0]
        metadatas = chroma_res.get('metadatas', [[]])[0]
        distances = chroma_res.get('distances', [[]])[0]

        records = []
        for idx in range(len(ids)):
            dist = distances[idx] if idx < len(distances) else 0.0
            # Cosine similarity score
            score = round(max(0.0, 1.0 - (dist / 2.0)), 4)
            records.append({
                'id': ids[idx],
                'document': documents[idx] if idx < len(documents) else '',
                'metadata': metadatas[idx] if idx < len(metadatas) else {},
                'score': score,
                'distance': dist
            })

        return jsonify({
            'collection_name': name,
            'count': len(records),
            'records': records
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@document_ws.route('/db/collections/<name>/records/<record_id>', methods=['PUT', 'OPTIONS'])
def update_db_record(name, record_id):
    """
    Update vector document text payload and/or metadata in ChromaDB.
    Re-generates vector embedding if document text is changed.
    """
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    try:
        data = request.get_json() or {}
        new_document = data.get('document')
        new_metadata = data.get('metadata')

        from utils.chroma_client_manager import get_chroma_collection
        from utils.transformers_model_manager import get_sentence_transformer_model

        collection = get_chroma_collection(name)

        update_kwargs = {'ids': [record_id]}

        if new_document is not None:
            doc_text = str(new_document).strip()
            model = get_sentence_transformer_model()
            embedding = model.encode(doc_text).tolist()
            update_kwargs['documents'] = [doc_text]
            update_kwargs['embeddings'] = [embedding]

        if new_metadata is not None and isinstance(new_metadata, dict):
            clean_meta = {}
            for k, v in new_metadata.items():
                if isinstance(v, (dict, list)):
                    import json
                    clean_meta[k] = json.dumps(v, ensure_ascii=False)
                else:
                    clean_meta[k] = clean_str(v)
            update_kwargs['metadatas'] = [clean_meta]

        collection.update(**update_kwargs)

        return jsonify({
            'message': f'Vecteur {record_id} mis à jour avec succès dans {name}.',
            'id': record_id
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500



from models.vector_collection import VectorCollection

@document_ws.route('/vector-collections', methods=['GET'])
def get_vector_collections():
    try:
        collections = VectorCollection.query.all()
        return jsonify({'collections': [c.as_dict() for c in collections]}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@document_ws.route('/vector-collections', methods=['POST'])
def create_vector_collection():
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        embedding_model = data.get('embedding_model', 'google/embeddinggemma-300m').strip()
        description = data.get('description', '').strip()

        if not name:
            return jsonify({'error': 'Name is required'}), 400

        # Check if already exists in SQL DB
        existing = VectorCollection.query.filter_by(name=name).first()
        if existing:
            return jsonify({'error': f'Collection {name} already exists'}), 400

        # Create in SQL DB
        new_col = VectorCollection(name=name, embedding_model=embedding_model, description=description)
        db.session.add(new_col)
        db.session.commit()

        # Pre-create in ChromaDB
        from utils.chroma_client_manager import get_chroma_collection
        get_chroma_collection(name)

        return jsonify({
            'message': f'Collection {name} created successfully',
            'collection': new_col.as_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@document_ws.route('/db/collections/<collection_name>/groupings', methods=['GET'])
def get_collection_groupings(collection_name):
    """Return all unique grouping values stored in a ChromaDB collection."""
    try:
        chroma_col = get_chroma_collection(collection_name)
        # Fetch all metadata in one shot (only metadata, no embeddings)
        data = chroma_col.get(include=["metadatas"])
        metadatas = data.get("metadatas") or []
        groupings = sorted({m.get("grouping") for m in metadatas if m and m.get("grouping")})
        return jsonify({"collection": collection_name, "groupings": groupings}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# 📄 PDF Serving — serve files from app/static/pdfs/
# ---------------------------------------------------------------------------
import os
from flask import send_from_directory, current_app

@document_ws.route('/pdfs/<path:filename>', methods=['GET'])
def serve_pdf(filename):
    """
    Serve a PDF file from the configured PDF_FOLDER.
    Explicitly forces inline display so browser renders it in PDF viewer rather than downloading.
    """
    pdf_folder = current_app.config.get('PDF_FOLDER', os.path.join(current_app.root_path, 'static', 'pdfs'))
    clean_filename = filename.replace('\\', '/').strip('/')
    response = send_from_directory(pdf_folder, clean_filename, mimetype='application/pdf', as_attachment=False)
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = 'inline'
    return response


@document_ws.route('/pdfs', methods=['GET'])
def list_pdfs():
    """List all PDF files available in the PDF_FOLDER."""
    try:
        pdf_folder = current_app.config.get('PDF_FOLDER', os.path.join(current_app.root_path, 'static', 'pdfs'))
        os.makedirs(pdf_folder, exist_ok=True)
        files = [
            {"name": f, "url": f"/api/documents/pdfs/{f}"}
            for f in sorted(os.listdir(pdf_folder))
            if f.lower().endswith('.pdf')
        ]
        return jsonify({"pdfs": files, "folder": pdf_folder}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# 📂 GROUPING MANAGEMENT ENDPOINTS
# ---------------------------------------------------------------------------
@document_ws.route('/db/groupings', methods=['GET'])
def get_all_groupings():
    """
    Get all document groupings with document count, collections list, and document details.
    """
    try:
        active_docs = Document.query.filter_by(ishidden=False).all()
        groupings_map = {}

        for doc in active_docs:
            grp = (doc.grouping or 'Sans grouping').strip()
            if grp not in groupings_map:
                groupings_map[grp] = {
                    'grouping': grp,
                    'document_count': 0,
                    'collections': set(),
                    'documents': []
                }
            groupings_map[grp]['document_count'] += 1
            if getattr(doc, 'collection_name', None):
                groupings_map[grp]['collections'].add(doc.collection_name)
            groupings_map[grp]['documents'].append(doc.as_dict())

        result = []
        for grp, data in groupings_map.items():
            result.append({
                'grouping': grp,
                'document_count': data['document_count'],
                'collections': sorted(list(data['collections'])),
                'documents': data['documents']
            })

        result.sort(key=lambda x: x['document_count'], reverse=True)
        return jsonify({'groupings': result, 'total_groupings': len(result)}), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@document_ws.route('/db/groupings/rename', methods=['PUT', 'POST'])
def rename_grouping():
    """
    Rename a grouping in SQL and propagate metadata updates to ChromaDB vector collections.
    """
    try:
        data = request.get_json() or {}
        old_name = (data.get('old_name') or '').strip()
        new_name = (data.get('new_name') or '').strip()

        if not old_name or not new_name:
            return jsonify({'error': 'L\'ancien nom et le nouveau nom sont requis.'}), 400

        if old_name == new_name:
            return jsonify({'message': 'Le nom du grouping reste inchangé.', 'updated_documents': 0, 'updated_vectors': 0}), 200

        matching_docs = Document.query.filter_by(grouping=old_name, ishidden=False).all()
        updated_doc_count = len(matching_docs)
        for doc in matching_docs:
            doc.grouping = new_name
        db.session.commit()

        from utils.chroma_client_manager import get_chroma_client
        client = get_chroma_client()
        updated_vector_count = 0

        for col in client.list_collections():
            try:
                res = col.get(where={"grouping": old_name}, include=["metadatas"])
                if res and res.get('ids'):
                    ids = res.get('ids', [])
                    metadatas = res.get('metadatas', [])
                    updated_metas = []
                    for m in metadatas:
                        m_copy = dict(m) if m else {}
                        m_copy['grouping'] = new_name
                        updated_metas.append(m_copy)

                    col.update(ids=ids, metadatas=updated_metas)
                    updated_vector_count += len(ids)
                    print(f"[INFO] Grouping renamed in ChromaDB '{col.name}': '{old_name}' -> '{new_name}' ({len(ids)} vectors)")
            except Exception as ce:
                print(f"[WARN] Error updating collection {col.name} for grouping rename: {ce}")

        return jsonify({
            'message': f'Grouping "{old_name}" renommé en "{new_name}". ({updated_doc_count} document(s) SQL et {updated_vector_count} vecteur(s) ChromaDB mis à jour).',
            'old_name': old_name,
            'new_name': new_name,
            'updated_documents': updated_doc_count,
            'updated_vectors': updated_vector_count
        }), 200

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@document_ws.route('/documents/<int:document_id>/grouping', methods=['PUT'])
def update_document_grouping(document_id):
    """
    Reassign a document's grouping in SQL and ChromaDB vector metadata.
    """
    try:
        doc = Document.query.get_or_404(document_id)
        data = request.get_json() or {}
        new_grouping = (data.get('grouping') or '').strip()

        doc.grouping = new_grouping
        db.session.commit()

        updated_vectors = 0
        from utils.chroma_client_manager import get_chroma_client
        client = get_chroma_client()
        for col in client.list_collections():
            try:
                res = col.get(where={"document_uuid": str(doc.uuid)}, include=["metadatas"])
                if res and res.get('ids'):
                    ids = res.get('ids', [])
                    metadatas = res.get('metadatas', [])
                    updated_metas = []
                    for m in metadatas:
                        m_copy = dict(m) if m else {}
                        m_copy['grouping'] = new_grouping
                        updated_metas.append(m_copy)

                    col.update(ids=ids, metadatas=updated_metas)
                    updated_vectors += len(ids)
            except Exception:
                pass

        return jsonify({
            'message': f'Grouping du document "{doc.name}" mis à jour avec succès.',
            'document': doc.as_dict(),
            'updated_vectors': updated_vectors
        }), 200

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@document_ws.route('/db/groupings/<path:grouping_name>', methods=['DELETE'])
def delete_grouping(grouping_name):
    """
    Dissolve or delete a grouping.
    Query parameter cascade=true soft-deletes associated documents and their ChromaDB vectors.
    """
    try:
        cascade = request.args.get('cascade', 'true').lower() == 'true'
        matching_docs = Document.query.filter_by(grouping=grouping_name, ishidden=False).all()
        doc_count = len(matching_docs)

        from utils.chroma_client_manager import get_chroma_client
        client = get_chroma_client()
        deleted_vectors_count = 0

        if cascade:
            for doc in matching_docs:
                doc.ishidden = True
                doc.status = StatusEnum.NOT_ACTIVE
                for col in client.list_collections():
                    try:
                        res = col.get(where={"document_uuid": str(doc.uuid)}, include=["metadatas"])
                        if res and res.get('ids'):
                            col.delete(ids=res['ids'])
                            deleted_vectors_count += len(res['ids'])
                    except Exception:
                        pass

            # Also delete any vectors directly matching grouping == grouping_name
            for col in client.list_collections():
                try:
                    res = col.get(where={"grouping": grouping_name}, include=["metadatas"])
                    if res and res.get('ids'):
                        col.delete(ids=res['ids'])
                        deleted_vectors_count += len(res['ids'])
                except Exception:
                    pass

            msg = f'Le groupe "{grouping_name}", ses {doc_count} document(s) et tous leurs vecteurs ChromaDB ont été supprimés avec succès.'
        else:
            for doc in matching_docs:
                doc.grouping = ''
                for col in client.list_collections():
                    try:
                        res = col.get(where={"document_uuid": str(doc.uuid)}, include=["metadatas"])
                        if res and res.get('ids'):
                            ids = res.get('ids', [])
                            metadatas = res.get('metadatas', [])
                            updated_metas = []
                            for m in metadatas:
                                m_copy = dict(m) if m else {}
                                m_copy['grouping'] = ''
                                updated_metas.append(m_copy)
                            col.update(ids=ids, metadatas=updated_metas)
                    except Exception:
                        pass
            msg = f'Grouping "{grouping_name}" dissous. {doc_count} document(s) réinitialisés sans grouping.'

        db.session.commit()
        return jsonify({
            'message': msg,
            'grouping': grouping_name,
            'affected_documents': doc_count,
            'deleted_vectors': deleted_vectors_count
        }), 200

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

